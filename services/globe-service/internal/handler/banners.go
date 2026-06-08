package handler

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/blobeNative/globe-service/internal/cache"
	"github.com/blobeNative/globe-service/internal/db"
	kafkapkg "github.com/blobeNative/globe-service/internal/kafka"
	"github.com/blobeNative/globe-service/internal/ranking"
	"github.com/blobeNative/globe-service/internal/spatial"
)

type BannersHandler struct {
	db          *db.DB
	cache       *cache.Cache
	quadtree    *spatial.Tree
	producer    *kafkapkg.Producer
	mlClient    *ranking.SageMakerClient
	blendWeight float64
	jwtSecret   []byte
}

func NewBannersHandler(
	database *db.DB,
	c *cache.Cache,
	qt *spatial.Tree,
	producer *kafkapkg.Producer,
	mlClient *ranking.SageMakerClient,
	blendWeight float64,
	jwtSecret string,
) *BannersHandler {
	return &BannersHandler{
		db:          database,
		cache:       c,
		quadtree:    qt,
		producer:    producer,
		mlClient:    mlClient,
		blendWeight: blendWeight,
		jwtSecret:   []byte(jwtSecret),
	}
}

// GetBanners handles GET /banners?bbox=minLon,minLat,maxLon,maxLat&zoom=N
func (h *BannersHandler) GetBanners(c *fiber.Ctx) error {
	bboxStr := c.Query("bbox")
	if bboxStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false, "error": "bbox query parameter is required",
		})
	}
	parts := strings.Split(bboxStr, ",")
	if len(parts) != 4 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false, "error": "bbox must be minLon,minLat,maxLon,maxLat",
		})
	}
	coords := make([]float64, 4)
	for i, p := range parts {
		v, err := strconv.ParseFloat(strings.TrimSpace(p), 64)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"success": false, "error": "bbox values must be numeric",
			})
		}
		coords[i] = v
	}
	minLon, minLat, maxLon, maxLat := coords[0], coords[1], coords[2], coords[3]
	if minLat < -90 || maxLat > 90 || minLon < -180 || maxLon > 180 || minLat > maxLat || minLon > maxLon {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"success": false, "error": "invalid bbox coordinates",
		})
	}

	zoom, _ := strconv.Atoi(c.Query("zoom", "12"))
	precision, maxResults := spatial.LOD(zoom)
	cells := spatial.BboxCoveringCells(minLon, minLat, maxLon, maxLat, precision)

	centerLat := (minLat + maxLat) / 2
	centerLon := (minLon + maxLon) / 2

	ctx := context.Background()
	seen := make(map[string]bool)
	var all []cache.GlobeBanner

	for _, cell := range cells {
		banners, err := h.resolve(ctx, cell, centerLat, centerLon)
		if err != nil {
			continue
		}
		for _, b := range banners {
			if !seen[b.ID] {
				seen[b.ID] = true
				all = append(all, b)
			}
		}
	}

	// Sort merged result by total score desc and cap at LOD limit.
	sortBanners(all)
	if len(all) > maxResults {
		all = all[:maxResults]
	}

	// Publish impression event asynchronously — never delays the HTTP response.
	if h.producer != nil && len(all) > 0 {
		ids := make([]string, len(all))
		scores := make([]float64, len(all))
		for i, b := range all {
			ids[i] = b.ID
			scores[i] = b.Score.Total
		}
		evt := kafkapkg.GlobeImpressionEvent{
			RequestID: uuid.New().String(),
			UserID:    h.extractUserID(c),
			CenterLat: centerLat,
			CenterLon: centerLon,
			ZoomLevel: zoom,
			BannerIDs: ids,
			Scores:    scores,
			ServedAt:  time.Now().UTC(),
		}
		go h.producer.PublishImpression(context.Background(), evt)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"banners":   all,
			"geohashes": cells,
		},
	})
}

// resolve returns banners for a cell using the three-tier lookup: QuadTree → Redis → PostGIS.
func (h *BannersHandler) resolve(ctx context.Context, cell string, centerLat, centerLon float64) ([]cache.GlobeBanner, error) {
	// 1. In-memory QuadTree.
	if banners, ok := h.quadtree.Get(cell); ok {
		return banners, nil
	}

	// 2. Redis.
	if banners, hit, err := h.cache.GetBanners(ctx, cell); err == nil && hit {
		h.quadtree.Set(cell, banners)
		return banners, nil
	}

	// 3. PostGIS.
	minLon, minLat, maxLon, maxLat := spatial.CellBBox(cell)
	posts, err := h.db.QueryPostsInEnvelope(ctx, minLon, minLat, maxLon, maxLat)
	if err != nil {
		return nil, err
	}

	ranked := ranking.Rank(posts, centerLat, centerLon, h.mlClient, h.blendWeight)
	banners := make([]cache.GlobeBanner, len(ranked))
	for i, r := range ranked {
		banners[i] = r.GlobeBanner
	}

	h.quadtree.Set(cell, banners)
	_ = h.cache.SetBanners(ctx, cell, banners)
	return banners, nil
}

// extractUserID parses the Authorization: Bearer <token> header and returns the
// subject claim. Returns an empty string for anonymous requests or invalid tokens.
func (h *BannersHandler) extractUserID(c *fiber.Ctx) string {
	auth := c.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return ""
	}
	tokenStr := strings.TrimPrefix(auth, "Bearer ")
	tok, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.ErrUnauthorized
		}
		return h.jwtSecret, nil
	})
	if err != nil || !tok.Valid {
		return ""
	}
	claims, ok := tok.Claims.(jwt.MapClaims)
	if !ok {
		return ""
	}
	sub, _ := claims["sub"].(string)
	return sub
}

func sortBanners(b []cache.GlobeBanner) {
	for i := 1; i < len(b); i++ {
		for j := i; j > 0 && b[j].Score.Total > b[j-1].Score.Total; j-- {
			b[j], b[j-1] = b[j-1], b[j]
		}
	}
}
