from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user_id
from ..database import get_db
from ..models import TrustScore
from ..schemas import TrustScoreResponse

router = APIRouter()


@router.get("/users/{user_id}/trust", response_model=TrustScoreResponse)
async def get_user_trust(
    user_id: str,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TrustScore).where(TrustScore.userId == user_id))
    trust_score = result.scalar_one_or_none()
    if not trust_score:
        raise HTTPException(status_code=404, detail="Trust score not found")

    return TrustScoreResponse(
        userId=trust_score.userId,
        score=trust_score.score,
        updatedAt=trust_score.updatedAt,
    )
