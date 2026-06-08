package kafka

import (
	"context"
	"encoding/json"
	"log"
	"time"

	kgo "github.com/segmentio/kafka-go"
)

// GlobeImpressionEvent is published to "globe-events" whenever banners are served.
type GlobeImpressionEvent struct {
	RequestID string    `json:"requestId"`
	UserID    string    `json:"userId"`   // empty string when request is anonymous
	CenterLat float64   `json:"centerLat"`
	CenterLon float64   `json:"centerLon"`
	ZoomLevel int       `json:"zoomLevel"`
	BannerIDs []string  `json:"bannerIds"` // ordered by rank (index 0 = top)
	Scores    []float64 `json:"scores"`    // parallel to bannerIds
	ServedAt  time.Time `json:"servedAt"`
}

// Producer publishes banner impression events to the globe-events Kafka topic.
type Producer struct {
	writer *kgo.Writer
}

func NewProducer(broker string) *Producer {
	return &Producer{
		writer: &kgo.Writer{
			Addr:     kgo.TCP(broker),
			Topic:    "globe-events",
			Balancer: &kgo.LeastBytes{},
		},
	}
}

// PublishImpression writes a banner impression event. Errors are logged and swallowed
// so they never block the calling HTTP handler.
func (p *Producer) PublishImpression(ctx context.Context, evt GlobeImpressionEvent) {
	b, err := json.Marshal(evt)
	if err != nil {
		log.Printf("globe-events marshal error: %v", err)
		return
	}
	if err := p.writer.WriteMessages(ctx, kgo.Message{
		Key:   []byte(evt.RequestID),
		Value: b,
	}); err != nil {
		log.Printf("globe-events publish error: %v", err)
	}
}

func (p *Producer) Close() { _ = p.writer.Close() }
