from .models import Vote


def compute_trust_score(votes: list[Vote], voter_scores: dict[str, float]) -> float:
    """
    Weighted vote tally: each voter's vote is weighted by their own trust score.
    Floor weight at 1.0 so new/unscored users still count as a normal vote.

    Returns a float score. The range is roughly [-max_weight, +max_weight] normalised
    to a weighted mean in [-1, 1].
    """
    weighted_sum = 0.0
    weight_total = 0.0
    for v in votes:
        weight = max(voter_scores.get(v.userId, 1.0), 1.0)
        weighted_sum += weight * v.value
        weight_total += weight
    if weight_total == 0.0:
        return 0.0
    return weighted_sum / weight_total
