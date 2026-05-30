package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/blobeNative/search-service/internal/trending"
)

type TrendingHandler struct {
	trending *trending.Counter
}

func NewTrendingHandler(t *trending.Counter) *TrendingHandler {
	return &TrendingHandler{trending: t}
}

func (h *TrendingHandler) Handle(c *fiber.Ctx) error {
	terms, err := h.trending.Top(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "trending unavailable"})
	}
	if terms == nil {
		terms = []string{}
	}
	return c.JSON(fiber.Map{"data": fiber.Map{"trending": terms}})
}
