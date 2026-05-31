import json
import logging
import uuid
from datetime import datetime, timezone

from aiokafka import AIOKafkaProducer

from ..config import settings

_log = logging.getLogger(__name__)
_producer: AIOKafkaProducer | None = None


async def start_producer() -> None:
    global _producer
    _producer = AIOKafkaProducer(
        bootstrap_servers=settings.kafka_broker,
        value_serializer=lambda v: json.dumps(v).encode(),
    )
    await _producer.start()
    _log.info("Kafka producer started")


async def stop_producer() -> None:
    if _producer:
        await _producer.stop()
        _log.info("Kafka producer stopped")


async def publish_moderation_event(
    *,
    record_id: str | None,
    post_id: str,
    author_id: str,
    decision: str,
    reason: str,
) -> None:
    payload = {
        "id": record_id or str(uuid.uuid4()),
        "postId": post_id,
        "authorId": author_id,
        "decision": decision,
        "reason": reason,
        "moderatedAt": datetime.now(timezone.utc).isoformat(),
    }
    await _producer.send_and_wait("moderation", value=payload)
