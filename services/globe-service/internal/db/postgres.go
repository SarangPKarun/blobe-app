package db

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PostRow struct {
	ID         string
	Title      string
	FrontText  *string
	BackText   *string
	MediaURL   *string
	AuthorID   string
	CreatedAt  time.Time
	Lon        float64
	Lat        float64
	TrustScore float64
	VoteSum    float64
	VoteCount  int64
}

type DB struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, dsn string) (*DB, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	return &DB{pool: pool}, nil
}

func (d *DB) Close() {
	d.pool.Close()
}

const queryPostsInEnvelope = `
SELECT
  p.id, p.title, p."frontText", p."backText", p."mediaUrl",
  p."authorId", p."createdAt",
  ST_X(p.location::geometry) AS lon,
  ST_Y(p.location::geometry) AS lat,
  COALESCE(ts.score, 0)      AS trust_score,
  COALESCE(SUM(v.value), 0)  AS vote_sum,
  COUNT(v.id)                AS vote_count
FROM "Post" p
LEFT JOIN "TrustScore" ts ON ts."userId" = p."authorId"
LEFT JOIN "Vote"        v  ON v."postId"  = p.id
WHERE ST_Intersects(
        p.location::geometry,
        ST_MakeEnvelope($1, $2, $3, $4, 4326)
      )
GROUP BY p.id, ts.score
`

// QueryPostsInEnvelope returns all posts whose location falls within the given WGS84 bounding box.
// Parameters: minLon, minLat, maxLon, maxLat.
func (d *DB) QueryPostsInEnvelope(ctx context.Context, minLon, minLat, maxLon, maxLat float64) ([]PostRow, error) {
	rows, err := d.pool.Query(ctx, queryPostsInEnvelope, minLon, minLat, maxLon, maxLat)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []PostRow
	for rows.Next() {
		var p PostRow
		if err := rows.Scan(
			&p.ID, &p.Title, &p.FrontText, &p.BackText, &p.MediaURL,
			&p.AuthorID, &p.CreatedAt,
			&p.Lon, &p.Lat,
			&p.TrustScore, &p.VoteSum, &p.VoteCount,
		); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	return posts, rows.Err()
}

const queryPostLocation = `
SELECT
  p."authorId", p."createdAt",
  ST_X(p.location::geometry) AS lon,
  ST_Y(p.location::geometry) AS lat,
  COALESCE(ts.score, 0)      AS trust_score,
  COALESCE(SUM(v.value), 0)  AS vote_sum,
  COUNT(v.id)                AS vote_count
FROM "Post" p
LEFT JOIN "TrustScore" ts ON ts."userId" = p."authorId"
LEFT JOIN "Vote"        v  ON v."postId"  = p.id
WHERE p.id = $1
GROUP BY p.id, p."authorId", p."createdAt", p.location, ts.score
`

type PostLocationRow struct {
	AuthorID   string
	CreatedAt  time.Time
	Lon        float64
	Lat        float64
	TrustScore float64
	VoteSum    float64
	VoteCount  int64
}

func (d *DB) QueryPostLocation(ctx context.Context, postID string) (*PostLocationRow, error) {
	row := d.pool.QueryRow(ctx, queryPostLocation, postID)
	var p PostLocationRow
	if err := row.Scan(
		&p.AuthorID, &p.CreatedAt,
		&p.Lon, &p.Lat,
		&p.TrustScore, &p.VoteSum, &p.VoteCount,
	); err != nil {
		return nil, err
	}
	return &p, nil
}
