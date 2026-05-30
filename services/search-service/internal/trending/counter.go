package trending

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	keyPrefix  = "search:trending:"
	unionKey   = "search:trending:union"
	bucketTTL  = 24 * time.Hour
	windowHours = 24
	topN       = 10
)

type Counter struct {
	rdb *redis.Client
}

func New(rdb *redis.Client) *Counter {
	return &Counter{rdb: rdb}
}

// Record increments the term count in the current hourly bucket.
func (c *Counter) Record(ctx context.Context, term string) {
	if term == "" {
		return
	}
	bucket := bucketKey()
	pipe := c.rdb.Pipeline()
	pipe.ZIncrBy(ctx, bucket, 1, term)
	pipe.Expire(ctx, bucket, bucketTTL)
	pipe.Exec(ctx) //nolint:errcheck — fire-and-forget
}

// Top returns the top-N trending terms across the last 24 hourly buckets.
func (c *Counter) Top(ctx context.Context) ([]string, error) {
	keys := pastBucketKeys(windowHours)
	if len(keys) == 0 {
		return nil, nil
	}

	weights := make([]float64, len(keys))
	for i := range weights {
		weights[i] = 1
	}

	pipe := c.rdb.Pipeline()
	pipe.ZUnionStore(ctx, unionKey, &redis.ZStore{
		Keys:    keys,
		Weights: weights,
	})
	pipe.Expire(ctx, unionKey, 10*time.Second)
	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return nil, fmt.Errorf("trending union: %w", err)
	}

	results, err := c.rdb.ZRevRangeWithScores(ctx, unionKey, 0, int64(topN-1)).Result()
	if err != nil {
		return nil, fmt.Errorf("trending range: %w", err)
	}
	c.rdb.Del(ctx, unionKey) //nolint:errcheck

	terms := make([]string, 0, len(results))
	for _, z := range results {
		terms = append(terms, z.Member.(string))
	}
	return terms, nil
}

func bucketKey() string {
	return keyPrefix + time.Now().UTC().Format("2006010215")
}

func pastBucketKeys(hours int) []string {
	now := time.Now().UTC().Truncate(time.Hour)
	keys := make([]string, hours)
	for i := range hours {
		keys[i] = keyPrefix + now.Add(-time.Duration(i)*time.Hour).Format("2006010215")
	}
	return keys
}
