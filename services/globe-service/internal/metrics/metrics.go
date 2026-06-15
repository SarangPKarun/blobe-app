package metrics

import (
	"context"
	"log"
	"time"

	kgo "github.com/segmentio/kafka-go"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// KafkaLag tracks the consumer lag per topic/group.
	KafkaLag = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "globe",
		Name:      "kafka_consumer_lag",
		Help:      "Current Kafka consumer lag (high-water mark minus committed offset).",
	}, []string{"topic", "group"})

	// MessagesProcessed counts successfully processed Kafka messages.
	MessagesProcessed = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "globe",
		Name:      "kafka_messages_processed_total",
		Help:      "Total Kafka messages processed by topic.",
	}, []string{"topic"})

	// WSDisconnections counts WebSocket client disconnections.
	WSDisconnections = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "globe",
		Name:      "ws_disconnections_total",
		Help:      "Total WebSocket client disconnections.",
	})
)

// RegisterWSConnectionsGauge adds a GaugeFunc that reads live connection count from fn.
func RegisterWSConnectionsGauge(fn func() int64) {
	promauto.NewGaugeFunc(prometheus.GaugeOpts{
		Namespace: "globe",
		Name:      "ws_connections_total",
		Help:      "Current number of active WebSocket connections.",
	}, func() float64 { return float64(fn()) })
}

// StartKafkaLagPoller polls reader stats every 15 s and updates the KafkaLag gauge.
func StartKafkaLagPoller(ctx context.Context, postReader, voteReader *kgo.Reader) {
	const group = "globe-service-group"
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				ps := postReader.Stats()
				KafkaLag.WithLabelValues("posts", group).Set(float64(ps.Lag))
				vs := voteReader.Stats()
				KafkaLag.WithLabelValues("trust-votes", group).Set(float64(vs.Lag))
				log.Printf("kafka lag — posts: %d  trust-votes: %d", ps.Lag, vs.Lag)
			}
		}
	}()
}
