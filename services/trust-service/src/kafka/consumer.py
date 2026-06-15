import asyncio
import json
import logging
from datetime import datetime

from aiokafka import AIOKafkaConsumer
from sqlalchemy import delete

from ..config import settings
from ..database import SessionLocal
from ..models import TrustAuditLog, TrustScore, Vote

logger = logging.getLogger(__name__)

_consumer_task: asyncio.Task | None = None


async def _run_consumer() -> None:
    consumer = AIOKafkaConsumer(
        "trust-votes",
        "moderation",
        "user.deleted",
        bootstrap_servers=settings.kafka_broker,
        group_id="trust-service-group",
        auto_offset_reset="latest",
        value_deserializer=lambda v: json.loads(v.decode()),
    )
    await consumer.start()
    logger.info("Kafka consumer started on trust-votes, moderation, user.deleted")
    try:
        async for msg in consumer:
            await _handle_message(msg.topic, msg.value)
    except asyncio.CancelledError:
        pass
    finally:
        await consumer.stop()
        logger.info("Kafka consumer stopped")


async def _handle_message(topic: str, raw: dict) -> None:
    # Handle both KafkaEvent-wrapped and raw payloads
    payload: dict = raw.get("payload", raw)
    if topic == "trust-votes":
        await _handle_vote(payload)
    elif topic == "moderation":
        await _handle_moderation(payload)
    elif topic == "user.deleted":
        await _handle_user_deleted(payload)


async def _handle_vote(payload: dict) -> None:
    try:
        async with SessionLocal() as db:
            entry = TrustAuditLog(
                eventType="VOTE_CAST",
                actorUserId=payload.get("voterId"),
                subjectUserId=payload.get("postAuthorId"),
                postId=payload.get("postId"),
                metadata_={"voteId": payload.get("id"), "value": payload.get("value")},
            )
            db.add(entry)
            await db.commit()
    except Exception:
        logger.exception("Failed to write audit log for trust-votes message")


async def _handle_moderation(payload: dict) -> None:
    try:
        async with SessionLocal() as db:
            entry = TrustAuditLog(
                eventType="MODERATION_APPLIED",
                subjectUserId=payload.get("authorId"),
                postId=payload.get("postId"),
                metadata_={
                    "moderationId": payload.get("id"),
                    "decision": payload.get("decision"),
                    "reason": payload.get("reason"),
                },
            )
            db.add(entry)
            await db.commit()
    except Exception:
        logger.exception("Failed to write audit log for moderation message")


async def _handle_user_deleted(payload: dict) -> None:
    user_id: str = payload.get("id", "")
    if not user_id:
        return
    try:
        async with SessionLocal() as db:
            await db.execute(delete(TrustScore).where(TrustScore.userId == user_id))
            await db.execute(delete(Vote).where(Vote.userId == user_id))
            await db.commit()
        logger.info("GDPR: deleted trust data for user %s", user_id)
    except Exception:
        logger.exception("Failed to delete trust data for user %s", user_id)


async def start_consumer() -> None:
    global _consumer_task
    _consumer_task = asyncio.create_task(_run_consumer())


async def stop_consumer() -> None:
    if _consumer_task:
        _consumer_task.cancel()
        try:
            await _consumer_task
        except asyncio.CancelledError:
            pass
