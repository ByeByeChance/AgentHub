import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 10 },   // ramp up to 10 users (SSE is connection-heavy)
    { duration: '1m', target: 10 },    // steady at 10 users
    { duration: '10s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // SSE setup < 3s
    http_req_failed: ['rate<0.10'],    // < 10% error rate (SSE can be flaky under load)
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || '';

export function setup() {
  // Create a conversation to use for message sending
  const headers = {
    'Content-Type': 'application/json',
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
  };
  const res = http.post(
    `${BASE_URL}/api/conversations`,
    JSON.stringify({ title: 'k6-load-test', mode: 'single' }),
    { headers },
  );
  const body = JSON.parse(res.body);
  return { conversationId: body.id };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
  };
  const res = http.post(
    `${BASE_URL}/api/conversations/${data.conversationId}/messages`,
    JSON.stringify({
      content: 'Say hello in one sentence.',
      agentId: null,
    }),
    { headers, timeout: 30000 },
  );
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response contains SSE data': (r) => r.body.includes('data:'),
  });
  sleep(3); // SSE connections are long-lived; throttle to avoid overlapping
}
