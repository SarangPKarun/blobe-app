import asyncio
import json
import logging
from datetime import datetime

from aiokafka import AIOKafkaConsumer

from ..config import settings
from ..database import SessionLocal
from ..models import TrustAuditLog

logger = logging.getLogger(__name__)

_consumer_task: asyncio.Task | None = None


async def _run_consumer() -> None:
    consumer = AIOKafkaConsumer(
        "trust-votes",
        bootstrap_servers=settings.kafka_broker,
        group_id="trust-service-group",
        auto_offset_reset="latest",
        value_deserializer=lambda v: json.loads(v.decode()),
    )
    await consumer.start()
    logger.info("Kafka consumer started on trust-votes")
    try:
        async for msg in consumer:
            await _handle_message(msg.value)
    except asyncio.CancelledError:
        pass
    finally:
        await consumer.stop()
        logger.info("Kafka consumer stopped")


async def _handle_message(raw: dict) -> None:
    # Handle both KafkaEvent-wrapped and raw payloads
    payload: dict = raw.get("payload", raw)
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
