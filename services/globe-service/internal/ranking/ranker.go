package ranking

import (
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

// Rank scores a slice of PostRow results relative to the bbox center and returns them sorted by rank desc.
func Rank(posts []db.PostRow, centerLat, centerLon float64) []RankedBanner {
	if len(posts) == 0 {
		return nil
	}

	// Find max vote sum for per-query normalization.
	var maxVoteSum float64
	for _, p := range posts {
		if p.VoteSum > maxVoteSum {
			maxVoteSum = p.VoteSum
		}
	}

	ranked := make([]RankedBanner, 0, len(posts))
	for _, p := range posts {
		r := score(p, centerLat, centerLon, maxVoteSum)
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
					Total:      r,
					Engagement: engagementScore(p.VoteSum, maxVoteSum),
					Recency:    recencyScore(p.CreatedAt),
				},
			},
			Rank: r,
		})
	}

	sort.Slice(ranked, func(i, j int) bool {
		return ranked[i].Rank > ranked[j].Rank
	})
	return ranked
}

func score(p db.PostRow, centerLat, centerLon, maxVoteSum float64) float64 {
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
