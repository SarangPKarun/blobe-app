package handler

import (
	"github.com/gofiber/fiber/v2"
	fiberws "github.com/gofiber/websocket/v2"
	"github.com/golang-jwt/jwt/v5"

	"github.com/blobeNative/globe-service/internal/ws"
)

type WSHandler struct {
	hub       *ws.Hub
	jwtSecret []byte
}

func NewWSHandler(hub *ws.Hub, jwtSecret string) *WSHandler {
	return &WSHandler{hub: hub, jwtSecret: []byte(jwtSecret)}
}

// UpgradeMiddleware rejects non-WebSocket requests and validates the ?token= JWT.
func (h *WSHandler) UpgradeMiddleware(c *fiber.Ctx) error {
	if !fiberws.IsWebSocketUpgrade(c) {
		return fiber.ErrUpgradeRequired
	}
	token := c.Query("token")
	if token == "" {
		return fiber.ErrUnauthorized
	}
	if _, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.ErrUnauthorized
		}
		return h.jwtSecret, nil
	}); err != nil {
		return fiber.ErrUnauthorized
	}
	return c.Next()
}

// Handle is the WebSocket handler registered after UpgradeMiddleware.
func (h *WSHandler) Handle(c *fiberws.Conn) {
	client := h.hub.NewClient(c)
	h.hub.Serve(client)
}
