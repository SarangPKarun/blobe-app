package ranking

import (
	"context"
	"log"
	"math"
	"sort"
	"time"

	"github.com/blobeNative/globe-service/internal/cache"
	"github.com/blobeNative/globe-service/internal/db"
)

type RankedBanner struct {
	cache.GlobeBanner
	Rank float64
}

// Rank scores a slice of PostRow results relative to the bbox center and returns them sorted
// by rank descending. When ml is non-nil and ML_ENABLED is true, scores are blended:
//
//	finalScore = blendWeight * mlScore + (1 - blendWeight) * algoScore
//
// On SageMaker timeout or error the algorithmic score is used as a silent fallback.
func Rank(posts []db.PostRow, centerLat, centerLon float64, ml *SageMakerClient, blendWeight float64) []RankedBanner {
	if len(posts) == 0 {
		return nil
	}

	var maxVoteSum float64
	for _, p := range posts {
		if p.VoteSum > maxVoteSum {
			maxVoteSum = p.VoteSum
		}
	}

	// Always compute algorithmic scores — these are the guaranteed fallback.
	algoScores := make([]float64, len(posts))
	for i, p := range posts {
		algoScores[i] = algoScore(p, centerLat, centerLon, maxVoteSum)
	}

	// Attempt ML scoring with a tight deadline (80 ms default).
	mlScores := tryMLScore(posts, centerLat, centerLon, ml)

	ranked := make([]RankedBanner, 0, len(posts))
	for i, p := range posts {
		final := algoScores[i]
		if mlScores != nil {
			w := blendWeight
			if w <= 0 || w > 1 {
				w = 0.7
			}
			final = w*mlScores[i] + (1-w)*algoScores[i]
		}

		var imgURL *string
		if p.MediaURL != nil {
			imgURL = p.MediaURL
		}
		ranked = append(ranked, RankedBanner{
			GlobeBanner: cache.GlobeBanner{
				ID:        p.ID,
				Latitude:  p.Lat,
				Longitude: p.Lon,
				Title:     p.Title,
				ImageURL:  imgURL,
				Score: cache.BannerScore{
					Total:      final,
					Engagement: engagementScore(p.VoteSum, maxVoteSum),
					Recency:    recencyScore(p.CreatedAt),
				},
			},
			Rank: final,
		})
	}

	sort.Slice(ranked, func(i, j int) bool {
		return ranked[i].Rank > ranked[j].Rank
	})
	return ranked
}

// tryMLScore calls the SageMaker endpoint within an 80 ms deadline.
// Returns nil silently on any failure.
func tryMLScore(posts []db.PostRow, centerLat, centerLon float64, client *SageMakerClient) []float64 {
	if client == nil {
		return nil
	}
	features := buildFeatures(posts, centerLat, centerLon)
	ctx, cancel := context.WithTimeout(context.Background(), 80*time.Millisecond)
	defer cancel()

	scores, err := client.ScoreBanners(ctx, features)
	if err != nil {
		log.Printf("WARN sagemaker score failed (algo fallback): %v", err)
		return nil
	}
	return scores
}

func buildFeatures(posts []db.PostRow, centerLat, centerLon float64) []BannerFeatures {
	features := make([]BannerFeatures, len(posts))
	for i, p := range posts {
		features[i] = BannerFeatures{
			TrustScore:        math.Max(p.TrustScore, 0.01),
			VoteSum:           p.VoteSum,
			VoteCount:         p.VoteCount,
			AgeHours:          time.Since(p.CreatedAt).Hours(),
			DistanceKm:        haversineKm(centerLat, centerLon, p.Lat, p.Lon),
			HateScore:         p.HateScore,
			SpamScore:         p.SpamScore,
			NsfwScore:         p.NsfwScore,
			UserAvgEngagement: 0, // populated by the feature store; 0 until available
			RankPosition:      i,
		}
	}
	return features
}

func algoScore(p db.PostRow, centerLat, centerLon, maxVoteSum float64) float64 {
	trust := math.Max(p.TrustScore, 0.01) // floor so new authors still appear
	eng := engagementScore(p.VoteSum, maxVoteSum)
	rec := recencyScore(p.CreatedAt)
	dist := distanceDecay(centerLat, centerLon, p.Lat, p.Lon)
	return trust * eng * rec * dist
}

func recencyScore(createdAt time.Time) float64 {
	ageHours := time.Since(createdAt).Hours()
	return math.Exp(-0.05 * ageHours) // half-life ≈ 13.9 h
}

func engagementScore(voteSum, maxVoteSum float64) float64 {
	return math.Log1p(math.Max(voteSum, 0)) / math.Log1p(maxVoteSum+1)
}

func distanceDecay(centerLat, centerLon, lat, lon float64) float64 {
	km := haversineKm(centerLat, centerLon, lat, lon)
	return 1.0 / (1.0 + km)
}

func haversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	const r = 6371.0
	dLat := toRad(lat2 - lat1)
	dLon := toRad(lon2 - lon1)
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRad(lat1))*math.Cos(toRad(lat2))*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	return r * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func toRad(deg float64) float64 {
	return deg * math.Pi / 180
}
