package kafka

import (
	"context"
	"encoding/json"
	"log"
	"time"

	kgo "github.com/segmentio/kafka-go"

	"github.com/blobeNative/search-service/internal/es"
)

type postCreatedPayload struct {
	ID        string  `json:"id"`
	AuthorID  string  `json:"authorId"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	FrontText string  `json:"frontText"`
	BackText  string  `json:"backText"`
	MediaURL  string  `json:"mediaUrl"`
	CreatedAt string  `json:"createdAt"`
}

// post-service may publish raw or wrapped in a KafkaEvent envelope.
type kafkaEventWrapper struct {
	Payload *postCreatedPayload `json:"payload"`
}

type Consumer struct {
	reader *kgo.Reader
	es     *es.Client
}

func New(broker string, esClient *es.Client) *Consumer {
	return &Consumer{
		reader: kgo.NewReader(kgo.ReaderConfig{
			Brokers:  []string{broker},
			GroupID:  "search-service-group",
			Topic:    "posts",
			MaxWait:  500 * time.Millisecond,
			MinBytes: 1,
			MaxBytes: 1 << 20,
		}),
		es: esClient,
	}
}

func (c *Consumer) Start(ctx context.Context) {
	go c.consume(ctx)
}

func (c *Consumer) Close() {
	c.reader.Close()
}

func (c *Consumer) consume(ctx context.Context) {
	for {
		msg, err := c.reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("kafka posts read error: %v", err)
			continue
		}

		var p postCreatedPayload
		var wrapper kafkaEventWrapper
		if json.Unmarshal(msg.Value, &wrapper) == nil && wrapper.Payload != nil {
			p = *wrapper.Payload
		} else if err := json.Unmarshal(msg.Value, &p); err != nil {
			log.Printf("kafka posts decode error: %v", err)
			continue
		}

		createdAt, _ := time.Parse(time.RFC3339, p.CreatedAt)
		if createdAt.IsZero() {
			createdAt = time.Now().UTC()
		}

		doc := es.PostDoc{
			ID:        p.ID,
			AuthorID:  p.AuthorID,
			FrontText: p.FrontText,
			BackText:  p.BackText,
			Location: es.GeoPoint{
				Lat: p.Latitude,
				Lon: p.Longitude,
			},
			CreatedAt: createdAt,
		}

		if err := c.es.IndexPost(ctx, doc); err != nil {
			log.Printf("ES index post %s error: %v", p.ID, err)
			continue
		}
		log.Printf("indexed post %s", p.ID)
	}
}
