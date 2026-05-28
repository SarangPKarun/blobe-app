package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const bannerTTL = 30 * time.Second

type GlobeBanner struct {
	ID        string      `json:"id"`
	Latitude  float64     `json:"latitude"`
	Longitude float64     `json:"longitude"`
	Title     string      `json:"title"`
	ImageURL  *string     `json:"imageUrl,omitempty"`
	Score     BannerScore `json:"score,omitempty"`
}

type BannerScore struct {
	Total      float64 `json:"total"`
	Engagement float64 `json:"engagement,omitempty"`
	Recency    float64 `json:"recency,omitempty"`
}

type Cache struct {
	client *redis.Client
}

func New(redisURL string) (*Cache, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &Cache{client: redis.NewClient(opts)}, nil
}

func (c *Cache) Close() error {
	return c.client.Close()
}

func bannerKey(geohash string) string {
	return fmt.Sprintf("globe:banners:%s", geohash)
}

func (c *Cache) GetBanners(ctx context.Context, geohash string) ([]GlobeBanner, bool, error) {
	raw, err := c.client.Get(ctx, bannerKey(geohash)).Bytes()
	if err == redis.Nil {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	var banners []GlobeBanner
	if err := json.Unmarshal(raw, &banners); err != nil {
		return nil, false, err
	}
	return banners, true, nil
}

func (c *Cache) SetBanners(ctx context.Context, geohash string, banners []GlobeBanner) error {
	raw, err := json.Marshal(banners)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, bannerKey(geohash), raw, bannerTTL).Err()
}

func (c *Cache) InvalidateBanners(ctx context.Context, geohash string) error {
	// Invalidate the cell and all ancestor precision cells (by prefix truncation).
	keys := make([]string, 0, len(geohash))
	for i := 1; i <= len(geohash); i++ {
		keys = append(keys, bannerKey(geohash[:i]))
	}
	return c.client.Del(ctx, keys...).Err()
}
