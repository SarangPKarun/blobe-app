package ranking

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// BannerFeatures is the per-banner feature vector sent to the SageMaker endpoint.
// Field names must match FEATURE_COLS in ml/models/banner_rank/features.py.
type BannerFeatures struct {
	TrustScore        float64 `json:"trust_score"`
	VoteSum           float64 `json:"vote_sum"`
	VoteCount         int64   `json:"vote_count"`
	AgeHours          float64 `json:"age_hours"`
	DistanceKm        float64 `json:"distance_km"`
	HateScore         float64 `json:"hate_score"`
	SpamScore         float64 `json:"spam_score"`
	NsfwScore         float64 `json:"nsfw_score"`
	UserAvgEngagement float64 `json:"user_avg_engagement"`
	RankPosition      int     `json:"rank_position"`
}

type smRequest  struct{ Instances []BannerFeatures `json:"instances"` }
type smResponse struct{ Scores []float64           `json:"scores"` }

// SageMakerClient calls the SageMaker real-time inference endpoint for banner scoring.
type SageMakerClient struct {
	endpoint string
	http     *http.Client
}

func NewSageMakerClient(endpoint string, timeoutMs int) *SageMakerClient {
	return &SageMakerClient{
		endpoint: endpoint,
		http:     &http.Client{Timeout: time.Duration(timeoutMs) * time.Millisecond},
	}
}

// ScoreBanners returns ML scores for a batch of banner feature vectors.
// Returns nil on any failure so callers can fall back to the algorithmic score.
func (c *SageMakerClient) ScoreBanners(ctx context.Context, features []BannerFeatures) ([]float64, error) {
	payload, err := json.Marshal(smRequest{Instances: features})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sagemaker: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sagemaker: status %d", resp.StatusCode)
	}
	var out smResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if len(out.Scores) != len(features) {
		return nil, fmt.Errorf("sagemaker: got %d scores for %d features", len(out.Scores), len(features))
	}
	return out.Scores, nil
}
