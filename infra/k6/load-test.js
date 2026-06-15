import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // ramp up
    { duration: '5m', target: 50 },   // steady load
    { duration: '2m', target: 50 },   // hold
    { duration: '1m', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<400'],  // p99 latency gate
    http_req_failed:   ['rate<0.01'],  // error rate gate (<1%)
    checks:            ['rate>0.99'],  // assertion pass rate
  },
};

const errorRate = new Rate('errors');

export default function () {
  group('health checks', () => {
    const services = [
      '/api/users/health',
      '/api/posts/health',
      '/api/notifications/health',
      '/api/search/health',
      '/api/payments/health',
      '/api/chat/health',
    ];
    for (const path of services) {
      const res = http.get(`${BASE_URL}${path}`, { tags: { name: path } });
      const ok = check(res, { [`${path} status 200`]: (r) => r.status === 200 });
      errorRate.add(!ok);
    }
  });

  group('auth flow', () => {
    const loginRes = http.post(
      `${BASE_URL}/api/users/auth/verify`,
      JSON.stringify({ idToken: 'staging-test-token' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    check(loginRes, {
      'auth returns 200 or 401': (r) => [200, 401].includes(r.status),
    });
    errorRate.add(loginRes.status >= 500);
  });

  group('post feed', () => {
    const feedRes = http.get(`${BASE_URL}/api/posts/feed?lat=37.7749&lng=-122.4194&radius=10`, {
      headers: { Authorization: 'Bearer staging-smoke-token' },
    });
    const ok = check(feedRes, {
      'feed status not 5xx': (r) => r.status < 500,
    });
    errorRate.add(!ok);
  });

  group('search typeahead', () => {
    const searchRes = http.get(`${BASE_URL}/api/search/typeahead?q=san+francisco`, {
      headers: { Authorization: 'Bearer staging-smoke-token' },
    });
    const ok = check(searchRes, {
      'typeahead status not 5xx': (r) => r.status < 500,
    });
    errorRate.add(!ok);
  });

  group('payment intent', () => {
    const piRes = http.post(
      `${BASE_URL}/api/payments/intent`,
      JSON.stringify({ amount: 500, currency: 'usd' }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer staging-smoke-token',
        },
      }
    );
    // 401 expected without a real token; 5xx means the service is broken
    const ok = check(piRes, {
      'payment intent not 5xx': (r) => r.status < 500,
    });
    errorRate.add(!ok);
  });

  sleep(1);
}
