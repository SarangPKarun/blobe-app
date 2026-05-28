package ws

import (
	"encoding/json"
	"sync"

	"github.com/gofiber/websocket/v2"
)

// Client represents a connected WebSocket client.
type Client struct {
	conn *websocket.Conn
	send chan []byte
	hub  *Hub
}

type inMsg struct {
	Type    string `json:"type"`
	Geohash string `json:"geohash"`
}

type outMsg struct {
	Type    string      `json:"type"`
	Geohash string      `json:"geohash,omitempty"`
	Banners interface{} `json:"banners,omitempty"`
}

// Hub manages WebSocket clients and geohash-cell subscriptions.
type Hub struct {
	mu    sync.RWMutex
	cells map[string]map[*Client]struct{}
}

func NewHub() *Hub {
	return &Hub{cells: make(map[string]map[*Client]struct{})}
}

func (h *Hub) NewClient(conn *websocket.Conn) *Client {
	return &Client{conn: conn, send: make(chan []byte, 64), hub: h}
}

func (h *Hub) subscribe(c *Client, geohash string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.cells[geohash] == nil {
		h.cells[geohash] = make(map[*Client]struct{})
	}
	h.cells[geohash][c] = struct{}{}
}

func (h *Hub) unsubscribe(c *Client, geohash string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if m, ok := h.cells[geohash]; ok {
		delete(m, c)
		if len(m) == 0 {
			delete(h.cells, geohash)
		}
	}
}

func (h *Hub) removeClient(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for hash, clients := range h.cells {
		delete(clients, c)
		if len(clients) == 0 {
			delete(h.cells, hash)
		}
	}
}

// Broadcast sends a banners_update message to all clients subscribed to geohash.
func (h *Hub) Broadcast(geohash string, banners interface{}) {
	msg, err := json.Marshal(outMsg{Type: "banners_update", Geohash: geohash, Banners: banners})
	if err != nil {
		return
	}
	h.mu.RLock()
	clients := h.cells[geohash]
	targets := make([]*Client, 0, len(clients))
	for c := range clients {
		targets = append(targets, c)
	}
	h.mu.RUnlock()

	for _, c := range targets {
		select {
		case c.send <- msg:
		default:
			// slow client — drop the frame rather than block
		}
	}
}

// Serve runs the read/write loops for a client. Blocks until the connection closes.
func (h *Hub) Serve(c *Client) {
	done := make(chan struct{})
	defer func() {
		h.removeClient(c)
		close(done) // signals the write goroutine to exit
		c.conn.Close()
	}()

	// Write loop in a separate goroutine.
	go func() {
		for {
			select {
			case msg := <-c.send:
				if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
					return
				}
			case <-done:
				return
			}
		}
	}()

	// Read loop.
	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var m inMsg
		if err := json.Unmarshal(raw, &m); err != nil {
			continue
		}
		switch m.Type {
		case "subscribe":
			if m.Geohash != "" {
				h.subscribe(c, m.Geohash)
			}
		case "unsubscribe":
			if m.Geohash != "" {
				h.unsubscribe(c, m.Geohash)
			}
		}
	}
}
