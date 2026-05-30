package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/redis/go-redis/v9"

	"github.com/blobeNative/search-service/internal/config"
	"github.com/blobeNative/search-service/internal/es"
	"github.com/blobeNative/search-service/internal/handler"
	kafkaconsumer "github.com/blobeNative/search-service/internal/kafka"
	"github.com/blobeNative/search-service/internal/trending"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// --- Redis ---
	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis parse url: %v", err)
	}
	rdb := redis.NewClient(opts)
	defer rdb.Close()

	// --- Elasticsearch ---
	esClient, err := es.New(cfg.ElasticsearchURL)
	if err != nil {
		log.Fatalf("es client: %v", err)
	}
	if err := esClient.EnsureIndex(ctx); err != nil {
		log.Fatalf("es ensure index: %v", err)
	}
	log.Println("ES index ensured")

	// --- Trending counter ---
	trendingCounter := trending.New(rdb)

	// --- Kafka consumer ---
	consumer := kafkaconsumer.New(cfg.KafkaBroker, esClient)
	consumer.Start(ctx)
	defer consumer.Close()

	// --- HTTP handlers ---
	weightsH := handler.NewWeightsHandler(esClient, trendingCounter)
	suggestH := handler.NewSuggestHandler(esClient, trendingCounter)
	trendingH := handler.NewTrendingHandler(trendingCounter)

	// --- Fiber app ---
	app := fiber.New(fiber.Config{AppName: "search-service"})
	app.Use(recover.New())
	app.Use(logger.New())

	app.Post("/search/weights", weightsH.Handle)
	app.Get("/search/suggest", suggestH.Handle)
	app.Get("/search/trending", trendingH.Handle)

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// --- Graceful shutdown ---
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-quit
		log.Println("shutting down search-service")
		cancel()
		_ = app.Shutdown()
	}()

	addr := ":" + cfg.Port
	log.Printf("search-service listening on %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
