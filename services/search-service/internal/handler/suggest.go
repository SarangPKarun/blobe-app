package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/blobeNative/search-service/internal/es"
	"github.com/blobeNative/search-service/internal/trending"
)

type SuggestHandler struct {
	es       *es.Client
	trending *trending.Counter
}

func NewSuggestHandler(esClient *es.Client, t *trending.Counter) *SuggestHandler {
	return &SuggestHandler{es: esClient, trending: t}
}

func (h *SuggestHandler) Handle(c *fiber.Ctx) error {
	q := c.Query("q")
	if len(q) < 2 {
		return c.JSON(fiber.Map{"data": fiber.Map{"suggestions": []string{}}})
	}

	suggestions, err := h.es.Suggest(c.Context(), q)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "suggest failed"})
	}
	if suggestions == nil {
		suggestions = []string{}
	}

	if len(q) >= 3 {
		go h.trending.Record(c.Context(), q)
	}

	return c.JSON(fiber.Map{"data": fiber.Map{"suggestions": suggestions}})
}
