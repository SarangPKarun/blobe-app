"""Shared feature column definition for banner_rank model.
Must match BannerFeatures struct in services/globe-service/internal/ranking/sagemaker.go.
"""

FEATURE_COLS = [
    "trust_score",
    "vote_sum",
    "vote_count",
    "age_hours",
    "distance_km",
    "hate_score",
    "spam_score",
    "nsfw_score",
    "user_avg_engagement",
    "rank_position",
]

LABEL_COL = "label"
