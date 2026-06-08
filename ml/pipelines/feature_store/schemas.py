"""PyArrow schemas for all feature store Parquet tables."""
import pyarrow as pa

# raw/globe_events/ — one row per (request, banner shown)
GLOBE_EVENTS_SCHEMA = pa.schema([
    pa.field("request_id",  pa.string(),     nullable=False),
    pa.field("user_id",     pa.string(),     nullable=True),   # null = anonymous
    pa.field("center_lat",  pa.float32(),    nullable=False),
    pa.field("center_lon",  pa.float32(),    nullable=False),
    pa.field("zoom_level",  pa.int8(),       nullable=False),
    pa.field("banner_id",   pa.string(),     nullable=False),
    pa.field("rank_position", pa.int16(),    nullable=False),
    pa.field("algo_score",  pa.float32(),    nullable=False),
    pa.field("ml_score",    pa.float32(),    nullable=True),
    pa.field("served_at",   pa.timestamp("us", tz="UTC"), nullable=False),
    pa.field("clicked",     pa.bool_(),      nullable=False),  # back-filled later
])

# features/banner_rank/ — assembled from globe_events + PostgreSQL join for XGBoost
BANNER_RANK_SCHEMA = pa.schema([
    pa.field("post_id",              pa.string(),  nullable=False),
    pa.field("label",                pa.float32(), nullable=False),  # clicked cast to float
    pa.field("trust_score",          pa.float32(), nullable=False),
    pa.field("vote_sum",             pa.float32(), nullable=False),
    pa.field("vote_count",           pa.int32(),   nullable=False),
    pa.field("age_hours",            pa.float32(), nullable=False),
    pa.field("distance_km",          pa.float32(), nullable=False),
    pa.field("hate_score",           pa.float32(), nullable=False),
    pa.field("spam_score",           pa.float32(), nullable=False),
    pa.field("nsfw_score",           pa.float32(), nullable=False),
    pa.field("user_avg_engagement",  pa.float32(), nullable=False),
    pa.field("rank_position",        pa.int16(),   nullable=False),
    pa.field("dt",                   pa.date32(),  nullable=False),  # partition column
])

# features/collab_filter/ — user × banner interaction weights for ALS/FAISS
COLLAB_FILTER_SCHEMA = pa.schema([
    pa.field("user_id",             pa.string(),  nullable=False),
    pa.field("banner_id",           pa.string(),  nullable=False),
    # click=1.0, impression=0.5, upvote=2.0, downvote=-1.0
    pa.field("interaction_weight",  pa.float32(), nullable=False),
    pa.field("last_interaction_at", pa.timestamp("us", tz="UTC"), nullable=False),
    pa.field("interaction_count",   pa.int32(),   nullable=False),
])

# features/trust_gnn/ — vote edge list for GraphSAGE training
TRUST_GNN_SCHEMA = pa.schema([
    pa.field("src_user_id",        pa.string(),  nullable=False),  # voter
    pa.field("dst_user_id",        pa.string(),  nullable=False),  # post author
    pa.field("vote_value",         pa.int8(),    nullable=False),  # -1, 0, 1
    pa.field("voter_trust_score",  pa.float32(), nullable=False),
    pa.field("post_id",            pa.string(),  nullable=False),
    pa.field("created_at",         pa.timestamp("us", tz="UTC"), nullable=False),
    pa.field("moderation_status",  pa.string(),  nullable=True),   # APPROVED/REJECTED/HELD
])
