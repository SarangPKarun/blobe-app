package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/blobeNative/search-service/internal/es"
	"github.com/blobeNative/search-service/internal/trending"
)

type WeightsHandler struct {
	es       *es.Client
	trending *trending.Counter
}

func NewWeightsHandler(esClient *es.Client, t *trending.Counter) *WeightsHandler {
	return &WeightsHandler{es: esClient, trending: t}
}

func (h *WeightsHandler) Handle(c *fiber.Ctx) error {
	q := c.Query("q")
	bbox := c.Query("bbox")

	if q == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "q is required"})
	}
	if bbox == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bbox is required"})
	}

	weights, err := h.es.SearchWeights(c.Context(), q, bbox)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	// Record term for trending — fire-and-forget.
	go h.trending.Record(c.Context(), q)

	return c.JSON(fiber.Map{"data": weights})
}
