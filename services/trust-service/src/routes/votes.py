import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user_id
from ..database import get_db
from ..kafka.producer import publish_trust_vote
from ..models import Post, TrustAuditLog, TrustScore, Vote
from ..schemas import PostVotesResponse, VoteRequest, VoteResponse, VoteSummary
from ..scoring import compute_trust_score

router = APIRouter()


@router.post("/votes", response_model=VoteResponse, status_code=status.HTTP_201_CREATED)
async def cast_vote(
    body: VoteRequest,
    voter_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Verify post exists and get author
    post = await db.get(Post, body.postId)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    author_id = post.authorId

    # Upsert vote (unique constraint: userId + postId)
    result = await db.execute(
        select(Vote).where(Vote.userId == voter_id, Vote.postId == body.postId)
    )
    vote = result.scalar_one_or_none()
    if vote:
        vote.value = body.value
    else:
        vote = Vote(
            id=str(uuid.uuid4()),
            userId=voter_id,
            postId=body.postId,
            value=body.value,
            createdAt=datetime.utcnow(),
        )
        db.add(vote)
    await db.flush()

    # Compute new trust score for the post author:
    # get all votes on all posts authored by them
    posts_result = await db.execute(select(Post.id).where(Post.authorId == author_id))
    post_ids = [row[0] for row in posts_result.all()]

    author_votes_result = await db.execute(select(Vote).where(Vote.postId.in_(post_ids)))
    author_votes = list(author_votes_result.scalars().all())

    voter_ids = list({v.userId for v in author_votes})
    scores_result = await db.execute(
        select(TrustScore).where(TrustScore.userId.in_(voter_ids))
    )
    voter_scores = {ts.userId: ts.score for ts in scores_result.scalars().all()}

    new_score = compute_trust_score(author_votes, voter_scores)

    # Upsert TrustScore for the author
    ts_result = await db.execute(select(TrustScore).where(TrustScore.userId == author_id))
    trust_score = ts_result.scalar_one_or_none()
    old_score = trust_score.score if trust_score else None
    if trust_score:
        trust_score.score = new_score
        trust_score.updatedAt = datetime.utcnow()
    else:
        trust_score = TrustScore(
            id=str(uuid.uuid4()),
            userId=author_id,
            score=new_score,
            createdAt=datetime.utcnow(),
            updatedAt=datetime.utcnow(),
        )
        db.add(trust_score)

    # Append immutable audit log entry
    db.add(
        TrustAuditLog(
            eventType="SCORE_UPDATED",
            subjectUserId=author_id,
            actorUserId=voter_id,
            postId=body.postId,
            oldScore=old_score,
            newScore=new_score,
            metadata_={"voteId": vote.id, "voteValue": body.value},
        )
    )

    await db.commit()

    # Publish trust-votes Kafka event → triggers globe-service re-rank
    await publish_trust_vote(
        vote_id=vote.id,
        post_id=body.postId,
        post_author_id=author_id,
        voter_id=voter_id,
        value=body.value,
        created_at=vote.createdAt,
    )

    return VoteResponse(
        id=vote.id,
        postId=body.postId,
        voterId=voter_id,
        value=body.value,
        createdAt=vote.createdAt,
        authorNewTrustScore=new_score,
    )


@router.get("/posts/{post_id}/votes", response_model=PostVotesResponse)
async def get_post_votes(
    post_id: str,
    _: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    result = await db.execute(select(Vote).where(Vote.postId == post_id))
    votes = list(result.scalars().all())

    return PostVotesResponse(
        postId=post_id,
        votes=[VoteSummary(id=v.id, userId=v.userId, value=v.value, createdAt=v.createdAt) for v in votes],
        upvotes=sum(1 for v in votes if v.value > 0),
        downvotes=sum(1 for v in votes if v.value < 0),
        total=len(votes),
    )
