package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	fiberws "github.com/gofiber/websocket/v2"

	"github.com/blobeNative/globe-service/internal/cache"
	"github.com/blobeNative/globe-service/internal/config"
	"github.com/blobeNative/globe-service/internal/db"
	"github.com/blobeNative/globe-service/internal/handler"
	kafkaconsumer "github.com/blobeNative/globe-service/internal/kafka"
	"github.com/blobeNative/globe-service/internal/ranking"
	"github.com/blobeNative/globe-service/internal/spatial"
	"github.com/blobeNative/globe-service/internal/ws"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// --- Database ---
	database, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer database.Close()

	// --- Redis ---
	redisCache, err := cache.New(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis connect: %v", err)
	}
	defer redisCache.Close()

	// --- In-memory QuadTree ---
	quadtree := &spatial.Tree{}

	// --- WebSocket hub ---
	hub := ws.NewHub()

	// --- Kafka consumer ---
	consumer := kafkaconsumer.New(cfg.KafkaBroker, database, redisCache, quadtree, hub)
	consumer.Start(ctx)
	defer consumer.Close()

	// --- Kafka producer (globe-events) ---
	producer := kafkaconsumer.NewProducer(cfg.KafkaBroker)
	defer producer.Close()

	// --- SageMaker client (nil when ML is disabled or endpoint not configured) ---
	var mlClient *ranking.SageMakerClient
	if cfg.MLEnabled && cfg.SageMakerEndpoint != "" {
		mlClient = ranking.NewSageMakerClient(cfg.SageMakerEndpoint, cfg.SageMakerTimeoutMs)
		log.Printf("ML scoring enabled: endpoint=%s timeout=%dms blend=%.2f",
			cfg.SageMakerEndpoint, cfg.SageMakerTimeoutMs, cfg.MLBlendWeight)
	}

	// --- HTTP handlers ---
	bannersH := handler.NewBannersHandler(database, redisCache, quadtree, producer, mlClient, cfg.MLBlendWeight, cfg.JWTSecret)
	wsH := handler.NewWSHandler(hub, cfg.JWTSecret)

	// --- Fiber app ---
	app := fiber.New(fiber.Config{
		AppName: "globe-service",
	})
	app.Use(recover.New())
	app.Use(logger.New())

	app.Get("/banners", bannersH.GetBanners)
	app.Get("/ws", wsH.UpgradeMiddleware, fiberws.New(wsH.Handle))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// --- Graceful shutdown ---
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-quit
		log.Println("shutting down globe-service")
		cancel()
		_ = app.Shutdown()
	}()

	addr := ":" + cfg.Port
	log.Printf("globe-service listening on %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
