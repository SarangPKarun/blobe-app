import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class ModerationRecord(Base):
    __tablename__ = "ModerationRecord"
    __table_args__ = (
        Index("idx_moderation_record_status", "status"),
        Index("idx_moderation_record_created", "createdAt"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    postId: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    authorId: Mapped[str] = mapped_column(String, nullable=False)
    # HELD | APPROVED | REJECTED
    status: Mapped[str] = mapped_column(String, nullable=False, default="HELD")
    reason: Mapped[str | None] = mapped_column(Text)
    # Snapshot of post content for reviewer display
    frontText: Mapped[str | None] = mapped_column(Text)
    backText: Mapped[str | None] = mapped_column(Text)
    mediaUrl: Mapped[str | None] = mapped_column(Text)
    # Classifier scores: {"hate": 0.3, "spam": 0.1, "nsfw": 0.9, "phash": false}
    scores: Mapped[dict | None] = mapped_column(JSON)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reviewedAt: Mapped[datetime | None] = mapped_column(DateTime)
    reviewedBy: Mapped[str | None] = mapped_column(String)


class CsamBlocklist(Base):
    __tablename__ = "CsamBlocklist"
    __table_args__ = (UniqueConstraint("phash"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    phash: Mapped[str] = mapped_column(String, nullable=False)
    addedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    note: Mapped[str | None] = mapped_column(Text)
