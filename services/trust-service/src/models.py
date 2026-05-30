"""
SQLAlchemy table definitions.

Prisma-managed tables (Vote, TrustScore, User, Post) are defined here with
`extend_existing=True` so SQLAlchemy can read/write them without owning their DDL.

Trust-service-owned tables (Appeal, AppealJuror, TrustAuditLog) are created by
database.create_tables() on startup.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# ---------------------------------------------------------------------------
# Prisma-managed (read/write only — DDL owned by Prisma migrations)
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "User"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str | None] = mapped_column(String, unique=True)
    username: Mapped[str | None] = mapped_column(String, unique=True)
    createdAt: Mapped[datetime] = mapped_column(DateTime)
    updatedAt: Mapped[datetime] = mapped_column(DateTime)

    trust_score: Mapped["TrustScore | None"] = relationship(back_populates="user")
    votes: Mapped[list["Vote"]] = relationship(back_populates="user")
    posts: Mapped[list["Post"]] = relationship(back_populates="author")


class Post(Base):
    __tablename__ = "Post"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String, primary_key=True)
    authorId: Mapped[str] = mapped_column(String, ForeignKey("User.id"))
    title: Mapped[str] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column(DateTime)
    updatedAt: Mapped[datetime] = mapped_column(DateTime)

    author: Mapped["User"] = relationship(back_populates="posts")
    votes: Mapped[list["Vote"]] = relationship(back_populates="post")


class Vote(Base):
    __tablename__ = "Vote"
    __table_args__ = (
        UniqueConstraint("userId", "postId"),
        {"extend_existing": True},
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id"))
    postId: Mapped[str] = mapped_column(String, ForeignKey("Post.id"))
    value: Mapped[int] = mapped_column(Integer)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="votes")
    post: Mapped["Post"] = relationship(back_populates="votes")


class TrustScore(Base):
    __tablename__ = "TrustScore"
    __table_args__ = {"extend_existing": True}

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id"), unique=True)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="trust_score")


# ---------------------------------------------------------------------------
# Trust-service-owned tables (DDL via database.create_tables)
# ---------------------------------------------------------------------------


class Appeal(Base):
    __tablename__ = "Appeal"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    userId: Mapped[str] = mapped_column(String, nullable=False)
    postId: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[str | None] = mapped_column(Text)
    # PENDING | IN_REVIEW | RESOLVED | REJECTED
    status: Mapped[str] = mapped_column(String, default="PENDING")
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolvedAt: Mapped[datetime | None] = mapped_column(DateTime)

    jurors: Mapped[list["AppealJuror"]] = relationship(back_populates="appeal")


class AppealJuror(Base):
    __tablename__ = "AppealJuror"
    __table_args__ = (UniqueConstraint("appealId", "jurorId"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    appealId: Mapped[str] = mapped_column(String, ForeignKey("Appeal.id"), nullable=False)
    jurorId: Mapped[str] = mapped_column(String, nullable=False)
    vote: Mapped[int | None] = mapped_column(Integer)
    votedAt: Mapped[datetime | None] = mapped_column(DateTime)

    appeal: Mapped["Appeal"] = relationship(back_populates="jurors")


class TrustAuditLog(Base):
    """Immutable append-only audit trail. Never update or delete rows."""

    __tablename__ = "TrustAuditLog"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    createdAt: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # VOTE_CAST | SCORE_UPDATED | APPEAL_FILED | APPEAL_RESOLVED
    eventType: Mapped[str] = mapped_column(String, nullable=False)
    subjectUserId: Mapped[str | None] = mapped_column(String)
    actorUserId: Mapped[str | None] = mapped_column(String)
    postId: Mapped[str | None] = mapped_column(String)
    oldScore: Mapped[float | None] = mapped_column(Float)
    newScore: Mapped[float | None] = mapped_column(Float)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON)
