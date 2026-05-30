import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user_id
from ..config import settings
from ..database import get_db
from ..jury import select_jury
from ..models import Appeal, Post, TrustAuditLog
from ..schemas import AppealRequest, AppealResponse

router = APIRouter()


@router.post("/appeals", response_model=AppealResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_appeal(
    body: AppealRequest,
    appellant_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, body.postId)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Only the post author may appeal votes against them
    if post.authorId != appellant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the post author can appeal votes on this post",
        )

    appeal_id = str(uuid.uuid4())
    appeal = Appeal(
        id=appeal_id,
        userId=appellant_id,
        postId=body.postId,
        reason=body.reason,
        evidence=body.evidence,
        status="PENDING",
        createdAt=datetime.utcnow(),
    )
    db.add(appeal)
    await db.flush()

    juror_ids = await select_jury(
        db=db,
        appeal_id=appeal_id,
        exclude_user_id=appellant_id,
        threshold=settings.jury_threshold,
        jury_size=settings.jury_size,
    )

    db.add(
        TrustAuditLog(
            eventType="APPEAL_FILED",
            subjectUserId=appellant_id,
            postId=body.postId,
            metadata_={"appealId": appeal_id, "jurorCount": len(juror_ids)},
        )
    )

    await db.commit()

    return AppealResponse(
        appealId=appeal_id,
        status="PENDING",
        jurorCount=len(juror_ids),
        createdAt=appeal.createdAt,
    )
