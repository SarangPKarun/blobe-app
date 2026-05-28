package handler

import (
	"context"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/blobeNative/globe-service/internal/cache"
	"github.com/blobeNative/globe-service/internal/db"
	"github.com/blobeNative/globe-service/internal/ranking"
	"github.com/blobeNative/globe-service/internal/spatial"
)

type BannersHandler struct {
	db       *db.DB
	cache    *cache.Cache
	quadtree *spatial.Tree
}

func NewBannersHandler(database *db.DB, c *cache.Cache, qt *spatial.Tree) *BannersHandler {
	return &BannersHandler{db: database, cache: c, quadtree: qt}
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

	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"banners":  all,
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

	ranked := ranking.Rank(posts, centerLat, centerLon)
	banners := make([]cache.GlobeBanner, len(ranked))
	for i, r := range ranked {
		banners[i] = r.GlobeBanner
	}

	h.quadtree.Set(cell, banners)
	_ = h.cache.SetBanners(ctx, cell, banners)
	return banners, nil
}

func sortBanners(b []cache.GlobeBanner) {
	for i := 1; i < len(b); i++ {
		for j := i; j > 0 && b[j].Score.Total > b[j-1].Score.Total; j-- {
			b[j], b[j-1] = b[j-1], b[j]
		}
	}
}
