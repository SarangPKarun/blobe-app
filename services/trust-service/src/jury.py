import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import AppealJuror, TrustScore


async def select_jury(
    db: AsyncSession,
    appeal_id: str,
    exclude_user_id: str,
    threshold: float,
    jury_size: int,
) -> list[str]:
    """
    Pick up to `jury_size` users whose trust score >= threshold,
    excluding the appellant. Returns the list of selected juror user IDs.
    """
    result = await db.execute(
        select(TrustScore.userId)
        .where(TrustScore.score >= threshold)
        .where(TrustScore.userId != exclude_user_id)
    )
    eligible: list[str] = [row[0] for row in result.all()]

    selected = random.sample(eligible, min(jury_size, len(eligible)))

    for user_id in selected:
        db.add(AppealJuror(appealId=appeal_id, jurorId=user_id))

    return selected
