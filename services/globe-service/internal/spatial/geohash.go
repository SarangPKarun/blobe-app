package spatial

import (
	"github.com/mmcloughlin/geohash"
)

// LODTier describes a zoom-level-to-geohash-precision mapping.
type LODTier struct {
	Precision  int
	MaxBanners int
}

var lodTable = []struct {
	minZoom int
	LODTier
}{
	{0, LODTier{2, 5}},
	{4, LODTier{3, 15}},
	{7, LODTier{4, 30}},
	{10, LODTier{5, 100}},
	{13, LODTier{6, 500}},
}

// LOD returns the geohash precision and max banner count for the given zoom level.
func LOD(zoom int) (precision, maxBanners int) {
	tier := lodTable[0].LODTier
	for _, entry := range lodTable {
		if zoom >= entry.minZoom {
			tier = entry.LODTier
		}
	}
	return tier.Precision, tier.MaxBanners
}

// BboxCoveringCells returns all geohash cells at the given precision that intersect the bbox.
// bbox is [minLon, minLat, maxLon, maxLat].
func BboxCoveringCells(minLon, minLat, maxLon, maxLat float64, precision int) []string {
	// Encode the four corners + center, collect unique neighbors.
	seeds := []string{
		geohash.EncodeWithPrecision(minLat, minLon, uint(precision)),
		geohash.EncodeWithPrecision(minLat, maxLon, uint(precision)),
		geohash.EncodeWithPrecision(maxLat, minLon, uint(precision)),
		geohash.EncodeWithPrecision(maxLat, maxLon, uint(precision)),
		geohash.EncodeWithPrecision((minLat+maxLat)/2, (minLon+maxLon)/2, uint(precision)),
	}

	visited := make(map[string]bool)
	queue := make([]string, 0, 32)

	for _, s := range seeds {
		if !visited[s] {
			visited[s] = true
			queue = append(queue, s)
		}
	}

	// BFS: expand neighbors that still intersect the bbox.
	for i := 0; i < len(queue); i++ {
		cell := queue[i]
		for _, nb := range geohash.Neighbors(cell) {
			if visited[nb] {
				continue
			}
			bb := geohash.BoundingBox(nb)
			if bb.MaxLat < minLat || bb.MinLat > maxLat ||
				bb.MaxLng < minLon || bb.MinLng > maxLon {
				continue
			}
			visited[nb] = true
			queue = append(queue, nb)
		}
	}
	return queue
}

// CellBBox returns the [minLon, minLat, maxLon, maxLat] bounding box for a geohash cell.
func CellBBox(hash string) (minLon, minLat, maxLon, maxLat float64) {
	bb := geohash.BoundingBox(hash)
	return bb.MinLng, bb.MinLat, bb.MaxLng, bb.MaxLat
}

// CellCenter returns the center [lat, lon] of a geohash cell.
func CellCenter(hash string) (lat, lon float64) {
	return geohash.Decode(hash)
}
