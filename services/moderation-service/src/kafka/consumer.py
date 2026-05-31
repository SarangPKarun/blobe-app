import asyncio
import json
import logging
import time
import uuid
from datetime import datetime

from aiokafka import AIOKafkaConsumer

from ..classifiers.image import classify_image_nsfw, download_image
from ..classifiers.phash import check_phash
from ..classifiers.text import classify_text
from ..config import settings
from ..database import SessionLocal
from ..kafka.producer import publish_moderation_event
from ..models import ModerationRecord

_log = logging.getLogger(__name__)
_consumer_task: asyncio.Task | None = None


def _apply_policy(scores: dict) -> tuple[str, str]:
    """Returns (decision, reason). decision: 'approved' | 'rejected' | 'flagged'."""
    # Hard reject on CSAM regardless of confidence settings
    if scores.get("phash") is True:
        return "rejected", "CSAM_DETECTED"

    checks = [
        ("HATE_SPEECH", scores.get("hate", 0.0), settings.text_hate_threshold),
        ("SPAM", scores.get("spam", 0.0), settings.text_spam_threshold),
        ("NSFW", scores.get("nsfw", 0.0), settings.nsfw_threshold),
    ]

    flagged_labels: list[str] = []
    for label, score, threshold in checks:
        if score >= settings.auto_approve_confidence:
            return "rejected", label
        if score >= threshold:
            flagged_labels.append(label)

    if flagged_labels:
        return "flagged", ",".join(flagged_labels)

    return "approved", "CLEAN"


async def _handle_post(payload: dict) -> None:
    t0 = time.monotonic()
    post_id: str = payload.get("id", str(uuid.uuid4()))
    author_id: str = payload.get("authorId", "")
    front_text: str | None = payload.get("frontText")
    back_text: str | None = payload.get("backText")
    media_url: str | None = payload.get("mediaUrl")

    combined_text = " ".join(filter(None, [front_text, back_text])) or None

    # --- Concurrently run all classifiers ---
    # Image download is shared between NSFW and pHash to avoid two HTTP calls
    img_task: asyncio.Task | None = None
    text_task: asyncio.Task | None = None

    if media_url:
        img_task = asyncio.create_task(download_image(media_url))
    if combined_text:
        text_task = asyncio.create_task(classify_text(combined_text))

    img_bytes: bytes | None = None
    if img_task:
        img_bytes = await img_task

    # Run image classifiers and text classifier concurrently
    nsfw_coro = classify_image_nsfw(img_bytes) if img_bytes else asyncio.sleep(0, result=0.0)
    phash_coro = check_phash(img_bytes) if img_bytes else asyncio.sleep(0, result=False)
    text_result_coro = text_task if text_task else asyncio.sleep(0, result={"hate": 0.0, "spam": 0.0})

    nsfw_score, phash_match, text_scores = await asyncio.gather(
        nsfw_coro, phash_coro, text_result_coro, return_exceptions=True
    )

    # Normalise exception results to safe defaults
    if isinstance(nsfw_score, Exception):
        _log.warning("NSFW classifier error: %s", nsfw_score)
        nsfw_score = 0.0
    if isinstance(phash_match, Exception):
        _log.warning("pHash check error: %s", phash_match)
        phash_match = False
    if isinstance(text_scores, Exception):
        _log.warning("Text classifier error: %s", text_scores)
        text_scores = {"hate": 0.0, "spam": 0.0}

    scores = {
        "hate": text_scores.get("hate", 0.0),
        "spam": text_scores.get("spam", 0.0),
        "nsfw": float(nsfw_score),
        "phash": bool(phash_match),
    }

    decision, reason = _apply_policy(scores)
    elapsed_ms = (time.monotonic() - t0) * 1000
    _log.info(
        "post=%s decision=%s reason=%s elapsed=%.0fms",
        post_id, decision, reason, elapsed_ms,
    )

    # Publish immediately for approved/rejected — before any DB write
    if decision in ("approved", "rejected"):
        await publish_moderation_event(
            record_id=None if decision == "approved" else None,
            post_id=post_id,
            author_id=author_id,
            decision=decision,
            reason=reason,
        )

    # Write DB record only for held/rejected posts (approved posts skip DB)
    if decision in ("rejected", "flagged"):
        record_id = str(uuid.uuid4())
        try:
            async with SessionLocal() as db:
                record = ModerationRecord(
                    id=record_id,
                    postId=post_id,
                    authorId=author_id,
                    status="REJECTED" if decision == "rejected" else "HELD",
                    reason=reason,
                    frontText=front_text,
                    backText=back_text,
                    mediaUrl=media_url,
                    scores=scores,
                    createdAt=datetime.utcnow(),
                )
                db.add(record)
                await db.commit()
        except Exception as exc:
            _log.exception("Failed to write ModerationRecord for post %s: %s", post_id, exc)


async def _run_consumer() -> None:
    consumer = AIOKafkaConsumer(
        "posts",
        bootstrap_servers=settings.kafka_broker,
        group_id="moderation-service-group",
        auto_offset_reset="latest",
        value_deserializer=lambda v: json.loads(v.decode()),
    )
    await consumer.start()
    _log.info("Kafka consumer started on posts")
    try:
        async for msg in consumer:
            raw: dict = msg.value
            payload: dict = raw.get("payload", raw)
            try:
                await _handle_post(payload)
            except Exception:
                _log.exception("Unhandled error processing post message")
    except asyncio.CancelledError:
        pass
    finally:
        await consumer.stop()
        _log.info("Kafka consumer stopped")


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
