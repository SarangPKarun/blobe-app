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
	// KafkaLag tracks the consumer lag for the posts topic.
	KafkaLag = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "search",
		Name:      "kafka_consumer_lag",
		Help:      "Current Kafka consumer lag (high-water mark minus committed offset).",
	}, []string{"topic", "group"})

	// MessagesProcessed counts successfully processed Kafka messages.
	MessagesProcessed = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "search",
		Name:      "kafka_messages_processed_total",
		Help:      "Total Kafka messages processed by topic.",
	}, []string{"topic"})

	// ESIndexErrors counts Elasticsearch indexing errors.
	ESIndexErrors = promauto.NewCounter(prometheus.CounterOpts{
		Namespace: "search",
		Name:      "es_index_errors_total",
		Help:      "Total Elasticsearch document indexing errors.",
	})
)

// StartKafkaLagPoller polls reader stats every 15 s and updates the KafkaLag gauge.
func StartKafkaLagPoller(ctx context.Context, reader *kgo.Reader) {
	const (
		topic = "posts"
		group = "search-service-group"
	)
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s := reader.Stats()
				KafkaLag.WithLabelValues(topic, group).Set(float64(s.Lag))
				log.Printf("kafka lag — posts: %d", s.Lag)
			}
		}
	}()
}
