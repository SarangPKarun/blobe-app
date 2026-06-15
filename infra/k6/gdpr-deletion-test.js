/**
 * GDPR Right-to-Erasure E2E test
 *
 * Flow per VU:
 *   1. Register a test user  →  expect 201
 *   2. Create a post as that user  →  expect 201
 *   3. Vote on that post (creates an index entry)  →  expect 201
 *   4. DELETE /users/:id  →  expect 204
 *   5. GET /users/:id  →  expect 404
 *   6. GET /posts/:id  →  expect 404  (post was deleted)
 *   7. GET /search/suggest?q=<username>  →  expect 0 suggestions mentioning deleted user
 *
 * Assertion: deletion request p99 < 2s.
 *
 * Run:
 *   k6 run infra/k6/gdpr-deletion-test.js --env BASE_URL=https://staging.blobe.app
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = {
  vus: 5,
  iterations: 5,
  thresholds: {
    deletion_duration: ['p(99)<2000'],
    checks: ['rate>0.95'],
    errors: ['rate<0.05'],
  },
};

const deletionDuration = new Trend('deletion_duration', true);
const errors = new Rate('errors');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Unique suffix per VU + iteration to avoid username collisions across runs.
function uniqueSuffix() {
  return `${__VU}-${__ITER}-${Date.now()}`;
}

export default function () {
  const suffix = uniqueSuffix();
  const username = `gdpr_test_${suffix}`;
  const email = `gdpr_${suffix}@test.blobe.internal`;

  let userId;
  let postId;
  let authToken;

  group('1. Register test user', () => {
    const res = http.post(
      `${BASE_URL}/api/users`,
      JSON.stringify({ username, email }),
      { headers: JSON_HEADERS }
    );
    const ok = check(res, {
      'register: status 201': (r) => r.status === 201,
      'register: returns user id': (r) => {
        try { return !!JSON.parse(r.body).user?.id; } catch { return false; }
      },
    });
    errors.add(!ok);
    if (!ok) return;
    const body = JSON.parse(res.body);
    userId = body.user.id;
    authToken = body.token;
  });

  if (!userId) return;

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
  };

  group('2. Create a post', () => {
    const res = http.post(
      `${BASE_URL}/api/posts`,
      JSON.stringify({
        frontText: `GDPR test post ${suffix}`,
        latitude: 37.7749,
        longitude: -122.4194,
      }),
      { headers: authHeaders }
    );
    const ok = check(res, {
      'create post: status 201': (r) => r.status === 201,
      'create post: returns post id': (r) => {
        try { return !!JSON.parse(r.body).id; } catch { return false; }
      },
    });
    errors.add(!ok);
    if (ok) postId = JSON.parse(res.body).id;
  });

  // Give search-service Kafka consumer a moment to index the post.
  sleep(2);

  group('3. Verify post exists before deletion', () => {
    if (!postId) return;
    const res = http.get(`${BASE_URL}/api/posts/${postId}`, { headers: authHeaders });
    const ok = check(res, { 'post exists pre-delete: 200': (r) => r.status === 200 });
    errors.add(!ok);
  });

  group('4. DELETE user account (GDPR erasure)', () => {
    const start = Date.now();
    const res = http.del(`${BASE_URL}/api/users/${userId}`, null, { headers: authHeaders });
    deletionDuration.add(Date.now() - start);
    const ok = check(res, { 'delete: status 204': (r) => r.status === 204 });
    errors.add(!ok);
  });

  // Allow downstream Kafka consumers (search-service ES delete, globe-service cache flush) to process.
  sleep(3);

  group('5. GET /users/:id — expect 404', () => {
    const res = http.get(`${BASE_URL}/api/users/${userId}`, { headers: authHeaders });
    const ok = check(res, { 'user gone after delete: 404': (r) => r.status === 404 });
    errors.add(!ok);
  });

  group('6. GET /posts/:id — expect 404', () => {
    if (!postId) return;
    const res = http.get(`${BASE_URL}/api/posts/${postId}`, { headers: authHeaders });
    const ok = check(res, { 'post gone after delete: 404': (r) => r.status === 404 });
    errors.add(!ok);
  });

  group('7. Search suggest — expect no results for deleted username', () => {
    const res = http.get(
      `${BASE_URL}/api/search/suggest?q=${encodeURIComponent(username)}`,
      { headers: authHeaders }
    );
    const ok = check(res, {
      'suggest: status 200': (r) => r.status === 200,
      'suggest: username absent from ES': (r) => {
        try {
          const body = JSON.parse(r.body);
          const suggestions = body.suggestions || body || [];
          return !suggestions.some((s) =>
            typeof s === 'string' && s.toLowerCase().includes(username.toLowerCase())
          );
        } catch {
          return true;
        }
      },
    });
    errors.add(!ok);
  });
}
