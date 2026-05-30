from datetime import datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Votes
# ---------------------------------------------------------------------------


class VoteRequest(BaseModel):
    postId: str
    value: int = Field(..., ge=-1, le=1, description="-1 downvote, 0 neutral, 1 upvote")


class VoteResponse(BaseModel):
    id: str
    postId: str
    voterId: str
    value: int
    createdAt: datetime
    authorNewTrustScore: float


class VoteSummary(BaseModel):
    id: str
    userId: str
    value: int
    createdAt: datetime


class PostVotesResponse(BaseModel):
    postId: str
    votes: list[VoteSummary]
    upvotes: int
    downvotes: int
    total: int


# ---------------------------------------------------------------------------
# Trust scores
# ---------------------------------------------------------------------------


class TrustScoreResponse(BaseModel):
    userId: str
    score: float
    updatedAt: datetime


# ---------------------------------------------------------------------------
# Appeals
# ---------------------------------------------------------------------------


class AppealRequest(BaseModel):
    postId: str
    reason: str = Field(..., min_length=10, max_length=2000)
    evidence: str | None = Field(None, max_length=5000)


class AppealResponse(BaseModel):
    appealId: str
    status: str
    jurorCount: int
    createdAt: datetime
