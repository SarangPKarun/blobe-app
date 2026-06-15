package es

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strings"
	"time"

	"github.com/elastic/go-elasticsearch/v8"
)

const (
	indexPosts   = "posts"
	indexSuggest = "posts_suggest"
)

type Client struct {
	es *elasticsearch.Client
}

func New(url string) (*Client, error) {
	cfg := elasticsearch.Config{Addresses: []string{url}}
	es, err := elasticsearch.NewClient(cfg)
	if err != nil {
		return nil, err
	}
	return &Client{es: es}, nil
}

// EnsureIndex creates the posts and posts_suggest indices if they don't exist.
// Retries up to maxAttempts to handle ES startup delay.
func (c *Client) EnsureIndex(ctx context.Context) error {
	const maxAttempts = 5
	var lastErr error
	for i := range maxAttempts {
		if err := c.ensureIndex(ctx); err != nil {
			lastErr = err
			log.Printf("ES not ready (attempt %d/%d): %v", i+1, maxAttempts, err)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(time.Duration(i+1) * 2 * time.Second):
			}
			continue
		}
		return nil
	}
	return fmt.Errorf("ES index setup failed after %d attempts: %w", maxAttempts, lastErr)
}

func (c *Client) ensureIndex(ctx context.Context) error {
	if err := c.createIndex(ctx, indexPosts, postsMapping); err != nil {
		return err
	}
	return c.createIndex(ctx, indexSuggest, suggestMapping)
}

func (c *Client) createIndex(ctx context.Context, name, mapping string) error {
	res, err := c.es.Indices.Exists([]string{name}, c.es.Indices.Exists.WithContext(ctx))
	if err != nil {
		return err
	}
	res.Body.Close()
	if res.StatusCode == 200 {
		return nil
	}
	res2, err := c.es.Indices.Create(name,
		c.es.Indices.Create.WithContext(ctx),
		c.es.Indices.Create.WithBody(strings.NewReader(mapping)),
	)
	if err != nil {
		return err
	}
	defer res2.Body.Close()
	if res2.IsError() {
		body, _ := io.ReadAll(res2.Body)
		return fmt.Errorf("create index %s: %s", name, body)
	}
	log.Printf("ES index %q created", name)
	return nil
}

// PostDoc is the document shape stored in ES.
type PostDoc struct {
	ID        string    `json:"id"`
	AuthorID  string    `json:"author_id"`
	FrontText string    `json:"front_text"`
	BackText  string    `json:"back_text"`
	Location  GeoPoint  `json:"location"`
	CreatedAt time.Time `json:"created_at"`
}

type GeoPoint struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// IndexPost indexes a post into both the posts and posts_suggest indices.
func (c *Client) IndexPost(ctx context.Context, doc PostDoc) error {
	body, _ := json.Marshal(doc)
	res, err := c.es.Index(indexPosts,
		bytes.NewReader(body),
		c.es.Index.WithContext(ctx),
		c.es.Index.WithDocumentID(doc.ID),
	)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.IsError() {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("index post %s: %s", doc.ID, b)
	}

	// Index into suggest index with completion input tokens derived from front_text.
	words := strings.Fields(doc.FrontText)
	inputs := buildSuggestInputs(words)
	sugDoc := map[string]any{
		"id":      doc.ID,
		"suggest": map[string]any{"input": inputs},
	}
	sb, _ := json.Marshal(sugDoc)
	res2, err := c.es.Index(indexSuggest,
		bytes.NewReader(sb),
		c.es.Index.WithContext(ctx),
		c.es.Index.WithDocumentID(doc.ID),
	)
	if err != nil {
		return err
	}
	defer res2.Body.Close()
	return nil
}

// DeleteByAuthor removes all posts (and their suggest entries) indexed for a given authorId.
// Used for GDPR right-to-erasure when a user account is deleted.
func (c *Client) DeleteByAuthor(ctx context.Context, authorID string) error {
	query := map[string]any{
		"query": map[string]any{
			"term": map[string]any{"author_id": authorID},
		},
	}
	body, _ := json.Marshal(query)

	for _, idx := range []string{indexPosts, indexSuggest} {
		res, err := c.es.DeleteByQuery(
			[]string{idx},
			bytes.NewReader(body),
			c.es.DeleteByQuery.WithContext(ctx),
		)
		if err != nil {
			return fmt.Errorf("delete_by_query %s for author %s: %w", idx, authorID, err)
		}
		_ = res.Body.Close()
	}
	return nil
}

// buildSuggestInputs returns prefix tokens for completion: ["foo", "foo bar", "foo bar baz"].
func buildSuggestInputs(words []string) []string {
	var inputs []string
	for i := range words {
		inputs = append(inputs, strings.Join(words[:i+1], " "))
	}
	return inputs
}

// SearchWeights runs a geo-bounded full-text query and returns a bannerId→score [0,1] map.
func (c *Client) SearchWeights(ctx context.Context, q, bbox string) (map[string]float64, error) {
	minLon, minLat, maxLon, maxLat, err := parseBbox(bbox)
	if err != nil {
		return nil, err
	}

	query := map[string]any{
		"size": 200,
		"query": map[string]any{
			"bool": map[string]any{
				"must": map[string]any{
					"multi_match": map[string]any{
						"query":  q,
						"fields": []string{"front_text^2", "back_text"},
					},
				},
				"filter": map[string]any{
					"geo_bounding_box": map[string]any{
						"location": map[string]any{
							"top_left":     map[string]any{"lat": maxLat, "lon": minLon},
							"bottom_right": map[string]any{"lat": minLat, "lon": maxLon},
						},
					},
				},
			},
		},
		"_source": false,
	}

	body, _ := json.Marshal(query)
	res, err := c.es.Search(
		c.es.Search.WithContext(ctx),
		c.es.Search.WithIndex(indexPosts),
		c.es.Search.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.IsError() {
		b, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("ES search error: %s", b)
	}

	var result struct {
		Hits struct {
			Hits []struct {
				ID    string  `json:"_id"`
				Score float64 `json:"_score"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, err
	}

	hits := result.Hits.Hits
	if len(hits) == 0 {
		return map[string]float64{}, nil
	}

	// Normalize to [0,1] by dividing by the max score (hits are sorted by score desc).
	maxScore := hits[0].Score
	weights := make(map[string]float64, len(hits))
	for _, h := range hits {
		score := 0.0
		if maxScore > 0 {
			score = h.Score / maxScore
		}
		weights[h.ID] = score
	}
	return weights, nil
}

// Suggest returns up to 8 completion suggestions for the given prefix.
func (c *Client) Suggest(ctx context.Context, q string) ([]string, error) {
	query := map[string]any{
		"suggest": map[string]any{
			"post-suggest": map[string]any{
				"prefix": q,
				"completion": map[string]any{
					"field": "suggest",
					"size":  8,
				},
			},
		},
	}

	body, _ := json.Marshal(query)
	res, err := c.es.Search(
		c.es.Search.WithContext(ctx),
		c.es.Search.WithIndex(indexSuggest),
		c.es.Search.WithBody(bytes.NewReader(body)),
	)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.IsError() {
		b, _ := io.ReadAll(res.Body)
		return nil, fmt.Errorf("ES suggest error: %s", b)
	}

	var result struct {
		Suggest map[string][]struct {
			Options []struct {
				Text string `json:"text"`
			} `json:"options"`
		} `json:"suggest"`
	}
	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		return nil, err
	}

	var suggestions []string
	for _, group := range result.Suggest["post-suggest"] {
		for _, opt := range group.Options {
			suggestions = append(suggestions, opt.Text)
		}
	}
	return suggestions, nil
}

func parseBbox(bbox string) (minLon, minLat, maxLon, maxLat float64, err error) {
	var vals [4]float64
	parts := strings.Split(bbox, ",")
	if len(parts) != 4 {
		return 0, 0, 0, 0, fmt.Errorf("bbox must be minLon,minLat,maxLon,maxLat")
	}
	for i, p := range parts {
		if _, err2 := fmt.Sscanf(strings.TrimSpace(p), "%f", &vals[i]); err2 != nil {
			return 0, 0, 0, 0, fmt.Errorf("bbox parse error at position %d: %w", i, err2)
		}
	}
	return vals[0], vals[1], vals[2], vals[3], nil
}

const postsMapping = `{
  "mappings": {
    "properties": {
      "id":         { "type": "keyword" },
      "author_id":  { "type": "keyword" },
      "front_text": { "type": "text", "copy_to": "suggest_text" },
      "back_text":  { "type": "text" },
      "suggest_text": { "type": "text" },
      "location":   { "type": "geo_point" },
      "created_at": { "type": "date" }
    }
  }
}`

const suggestMapping = `{
  "mappings": {
    "properties": {
      "id":      { "type": "keyword" },
      "suggest": { "type": "completion" }
    }
  }
}`
