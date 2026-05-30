import json
import logging
from datetime import datetime, timezone

from aiokafka import AIOKafkaProducer

from ..config import settings

logger = logging.getLogger(__name__)

_producer: AIOKafkaProducer | None = None


async def start_producer() -> None:
    global _producer
    _producer = AIOKafkaProducer(
        bootstrap_servers=settings.kafka_broker,
        value_serializer=lambda v: json.dumps(v).encode(),
    )
    await _producer.start()
    logger.info("Kafka producer started")


async def stop_producer() -> None:
    if _producer:
        await _producer.stop()
        logger.info("Kafka producer stopped")


async def publish_trust_vote(
    vote_id: str,
    post_id: str,
    post_author_id: str,
    voter_id: str,
    value: int,
    created_at: datetime,
) -> None:
    if not _producer:
        logger.warning("Producer not initialised — skipping Kafka publish")
        return
    payload = {
        "id": vote_id,
        "postId": post_id,
        "postAuthorId": post_author_id,
        "voterId": voter_id,
        "value": value,
        "createdAt": created_at.replace(tzinfo=timezone.utc).isoformat(),
    }
    await _producer.send_and_wait("trust-votes", value=payload)
    logger.debug("Published trust-votes event for vote %s", vote_id)
