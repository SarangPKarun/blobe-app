package spatial

import (
	"strings"
	"sync"

	"github.com/blobeNative/globe-service/internal/cache"
)

// base32 is the geohash alphabet — maps a character to its node index.
const base32 = "0123456789bcdefghjkmnpqrstuvwxyz"

func charIndex(c byte) int {
	return strings.IndexByte(base32, c)
}

type node struct {
	mu       sync.RWMutex
	banners  []cache.GlobeBanner
	children [32]*node
}

// Tree is a geohash-keyed trie that stores ranked banner lists per cell.
// It acts as a write-through memory layer in front of Redis so Kafka events
// can update the in-process cache without a network round-trip on the read path.
type Tree struct {
	root node
}

func (t *Tree) getNode(hash string, create bool) *node {
	cur := &t.root
	for i := 0; i < len(hash); i++ {
		idx := charIndex(hash[i])
		if idx < 0 {
			return nil
		}
		cur.mu.Lock()
		if cur.children[idx] == nil {
			if !create {
				cur.mu.Unlock()
				return nil
			}
			cur.children[idx] = &node{}
		}
		child := cur.children[idx]
		cur.mu.Unlock()
		cur = child
	}
	return cur
}

// Get returns the banner list for the given geohash, and whether it was found.
func (t *Tree) Get(hash string) ([]cache.GlobeBanner, bool) {
	n := t.getNode(hash, false)
	if n == nil {
		return nil, false
	}
	n.mu.RLock()
	defer n.mu.RUnlock()
	if n.banners == nil {
		return nil, false
	}
	out := make([]cache.GlobeBanner, len(n.banners))
	copy(out, n.banners)
	return out, true
}

// Set stores a banner list at the given geohash and invalidates all ancestor nodes.
func (t *Tree) Set(hash string, banners []cache.GlobeBanner) {
	n := t.getNode(hash, true)
	if n == nil {
		return
	}
	n.mu.Lock()
	n.banners = banners
	n.mu.Unlock()

	// Ancestors need to be recomputed on next read.
	for i := 1; i < len(hash); i++ {
		t.invalidateNode(hash[:i])
	}
}

// Invalidate marks the node at the given geohash (and its ancestors) as stale.
func (t *Tree) Invalidate(hash string) {
	for i := 1; i <= len(hash); i++ {
		t.invalidateNode(hash[:i])
	}
}

func (t *Tree) invalidateNode(hash string) {
	n := t.getNode(hash, false)
	if n == nil {
		return
	}
	n.mu.Lock()
	n.banners = nil
	n.mu.Unlock()
}
