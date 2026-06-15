package kafka

import (
	"context"
	"encoding/json"
	"log"
	"time"

	kgo "github.com/segmentio/kafka-go"

	"github.com/blobeNative/globe-service/internal/cache"
	"github.com/blobeNative/globe-service/internal/db"
	"github.com/blobeNative/globe-service/internal/metrics"
	"github.com/blobeNative/globe-service/internal/ranking"
	"github.com/blobeNative/globe-service/internal/spatial"
	"github.com/blobeNative/globe-service/internal/ws"
	"github.com/mmcloughlin/geohash"
)

type userDeletedPayload struct {
	ID string `json:"id"`
}

type postCreatedPayload struct {
	ID        string  `json:"id"`
	AuthorID  string  `json:"authorId"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	FrontText *string `json:"frontText"`
	BackText  *string `json:"backText"`
	MediaURL  *string `json:"mediaUrl"`
	CreatedAt string  `json:"createdAt"`
}

// post-service may publish as raw payload or wrapped in a KafkaEvent envelope.
type kafkaEventWrapper struct {
	Payload *postCreatedPayload `json:"payload"`
}

type trustVotePayload struct {
	ID           string  `json:"id"`
	PostID       string  `json:"postId"`
	PostAuthorID string  `json:"postAuthorId"`
	VoterID      string  `json:"voterId"`
	Value        float64 `json:"value"`
	CreatedAt    string  `json:"createdAt"`
}

// Consumer wires Kafka topics to re-rank logic.
type Consumer struct {
	postReader    *kgo.Reader
	voteReader    *kgo.Reader
	deletedReader *kgo.Reader
	db            *db.DB
	cache         *cache.Cache
	quadtree      *spatial.Tree
	hub           *ws.Hub
}

func New(broker string, database *db.DB, c *cache.Cache, qt *spatial.Tree, hub *ws.Hub) *Consumer {
	return &Consumer{
		postReader: kgo.NewReader(kgo.ReaderConfig{
			Brokers:  []string{broker},
			GroupID:  "globe-service-group",
			Topic:    "posts",
			MaxWait:  500 * time.Millisecond,
			MinBytes: 1,
			MaxBytes: 1 << 20,
		}),
		voteReader: kgo.NewReader(kgo.ReaderConfig{
			Brokers:  []string{broker},
			GroupID:  "globe-service-group",
			Topic:    "trust-votes",
			MaxWait:  500 * time.Millisecond,
			MinBytes: 1,
			MaxBytes: 1 << 20,
		}),
		deletedReader: kgo.NewReader(kgo.ReaderConfig{
			Brokers:  []string{broker},
			GroupID:  "globe-service-group",
			Topic:    "user.deleted",
			MaxWait:  500 * time.Millisecond,
			MinBytes: 1,
			MaxBytes: 1 << 20,
		}),
		db:       database,
		cache:    c,
		quadtree: qt,
		hub:      hub,
	}
}

func (c *Consumer) Start(ctx context.Context) {
	go c.consumePosts(ctx)
	go c.consumeVotes(ctx)
	go c.consumeUserDeleted(ctx)
}

func (c *Consumer) Close() {
	c.postReader.Close()
	c.voteReader.Close()
	c.deletedReader.Close()
}

// PostReader exposes the underlying kafka-go Reader for metrics polling.
func (c *Consumer) PostReader() *kgo.Reader { return c.postReader }

// VoteReader exposes the underlying kafka-go Reader for metrics polling.
func (c *Consumer) VoteReader() *kgo.Reader { return c.voteReader }

func (c *Consumer) consumePosts(ctx context.Context) {
	for {
		msg, err := c.postReader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("kafka posts read error: %v", err)
			continue
		}

		var p postCreatedPayload
		// Try wrapped envelope first, then raw.
		var wrapper kafkaEventWrapper
		if json.Unmarshal(msg.Value, &wrapper) == nil && wrapper.Payload != nil {
			p = *wrapper.Payload
		} else if err := json.Unmarshal(msg.Value, &p); err != nil {
			log.Printf("kafka posts decode error: %v", err)
			continue
		}

		metrics.MessagesProcessed.WithLabelValues("posts").Inc()
		c.reRankForLocation(ctx, p.Latitude, p.Longitude)
	}
}

func (c *Consumer) consumeVotes(ctx context.Context) {
	for {
		msg, err := c.voteReader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("kafka trust-votes read error: %v", err)
			continue
		}

		var v trustVotePayload
		if err := json.Unmarshal(msg.Value, &v); err != nil {
			log.Printf("kafka trust-votes decode error: %v", err)
			continue
		}

		metrics.MessagesProcessed.WithLabelValues("trust-votes").Inc()
		// Fetch the post's location then re-rank its cells.
		row, err := c.db.QueryPostLocation(ctx, v.PostID)
		if err != nil {
			log.Printf("kafka trust-votes: post location query failed for %s: %v", v.PostID, err)
			continue
		}
		c.reRankForLocation(ctx, row.Lat, row.Lon)
	}
}

func (c *Consumer) consumeUserDeleted(ctx context.Context) {
	for {
		msg, err := c.deletedReader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("kafka user.deleted read error: %v", err)
			continue
		}
		var p userDeletedPayload
		if err := json.Unmarshal(msg.Value, &p); err != nil {
			log.Printf("kafka user.deleted decode error: %v", err)
			continue
		}
		if err := c.cache.FlushAllBanners(ctx); err != nil {
			log.Printf("GDPR flush banners for user %s error: %v", p.ID, err)
		} else {
			log.Printf("GDPR: flushed banner cache for deleted user %s", p.ID)
		}
		metrics.MessagesProcessed.WithLabelValues("user.deleted").Inc()
	}
}

// reRankForLocation invalidates + repopulates all geohash precisions for a given lat/lon.
func (c *Consumer) reRankForLocation(ctx context.Context, lat, lon float64) {
	for precision := 2; precision <= 6; precision++ {
		hash := geohash.EncodeWithPrecision(lat, lon, uint(precision))
		minLon, minLat, maxLon, maxLat := spatial.CellBBox(hash)
		centerLat, centerLon := spatial.CellCenter(hash)

		posts, err := c.db.QueryPostsInEnvelope(ctx, minLon, minLat, maxLon, maxLat)
		if err != nil {
			log.Printf("kafka re-rank db error for %s: %v", hash, err)
			continue
		}

		ranked := ranking.Rank(posts, centerLat, centerLon, nil, 0)
		banners := make([]cache.GlobeBanner, len(ranked))
		for i, r := range ranked {
			banners[i] = r.GlobeBanner
		}

		c.quadtree.Set(hash, banners)
		if err := c.cache.SetBanners(ctx, hash, banners); err != nil {
			log.Printf("kafka re-rank redis error for %s: %v", hash, err)
		}
		c.hub.Broadcast(hash, banners)
	}
}
