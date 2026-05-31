import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user_id
from ..database import get_db
from ..kafka.producer import publish_moderation_event
from ..models import ModerationRecord
from ..schemas import QueueItem, QueueListResponse, ReviewRequest

_log = logging.getLogger(__name__)
router = APIRouter(prefix="/queue", tags=["queue"])


@router.get("", response_model=QueueListResponse)
async def list_queue(
    reviewer_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    rows = await db.execute(
        select(ModerationRecord)
        .where(ModerationRecord.status == "HELD")
        .order_by(ModerationRecord.createdAt.asc())
        .limit(limit)
        .offset(offset)
    )
    records = rows.scalars().all()

    count_row = await db.execute(
        select(func.count()).select_from(ModerationRecord).where(ModerationRecord.status == "HELD")
    )
    total = count_row.scalar_one()

    return QueueListResponse(
        items=[QueueItem.model_validate(r) for r in records],
        total=total,
    )


async def _get_held_record(db: AsyncSession, record_id: str) -> ModerationRecord:
    row = await db.execute(
        select(ModerationRecord).where(
            ModerationRecord.id == record_id,
            ModerationRecord.status == "HELD",
        )
    )
    record = row.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found or not in HELD state")
    return record


@router.post("/{record_id}/approve", status_code=200)
async def approve_post(
    record_id: str,
    body: ReviewRequest,
    reviewer_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    record = await _get_held_record(db, record_id)
    record.status = "APPROVED"
    record.reviewedAt = datetime.utcnow()
    record.reviewedBy = reviewer_id
    if body.reason:
        record.reason = body.reason
    await db.commit()

    await publish_moderation_event(
        record_id=record.id,
        post_id=record.postId,
        author_id=record.authorId,
        decision="approved",
        reason=record.reason or "HUMAN_APPROVED",
    )
    _log.info("Record %s approved by %s", record_id, reviewer_id)
    return {"status": "approved"}


@router.post("/{record_id}/reject", status_code=200)
async def reject_post(
    record_id: str,
    body: ReviewRequest,
    reviewer_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    record = await _get_held_record(db, record_id)
    record.status = "REJECTED"
    record.reviewedAt = datetime.utcnow()
    record.reviewedBy = reviewer_id
    if body.reason:
        record.reason = body.reason
    await db.commit()

    await publish_moderation_event(
        record_id=record.id,
        post_id=record.postId,
        author_id=record.authorId,
        decision="rejected",
        reason=record.reason or "HUMAN_REJECTED",
    )
    _log.info("Record %s rejected by %s", record_id, reviewer_id)
    return {"status": "rejected"}
