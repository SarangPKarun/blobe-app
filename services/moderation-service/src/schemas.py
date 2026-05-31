from datetime import datetime

from pydantic import BaseModel


class QueueItem(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    postId: str
    authorId: str
    frontText: str | None
    backText: str | None
    mediaUrl: str | None
    scores: dict | None
    reason: str | None
    createdAt: datetime


class QueueListResponse(BaseModel):
    items: list[QueueItem]
    total: int


class ReviewRequest(BaseModel):
    reason: str | None = None
