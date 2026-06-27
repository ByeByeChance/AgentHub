import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 30 },   // ramp up to 30 users
    { duration: '1m', target: 30 },    // steady at 30 users
    { duration: '10s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // agent listing < 500ms
    http_req_failed: ['rate<0.05'],    // < 5% error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || '';

export default function () {
  const headers = API_KEY
    ? { Authorization: `Bearer ${API_KEY}` }
    : {};

  const res = http.get(`${BASE_URL}/api/agents`, { headers });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response is JSON': (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
  });
  sleep(1);
}
