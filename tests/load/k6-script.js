import http from 'k6/http';
import { check, sleep } from 'k6';

// Konfigurasi Load Test
export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp-up ke 20 users
    { duration: '1m', target: 20 },  // Stay di 20 users
    { duration: '30s', target: 0 },  // Ramp-down ke 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% request harus di bawah 500ms
    http_req_failed: ['rate<0.01'],   // Error rate harus di bawah 1%
  },
};

export default function () {
  // Target ke HAProxy (port 80 host atau service name di internal network)
  // Saat dijalankan di dalam container network, gunakan http://haproxy:8080
  const BASE_URL = __ENV.BASE_URL || 'http://ecommerce-haproxy:8080';

  const res = http.get(`${BASE_URL}/health`, { tags: { name: 'HealthCheck' } });

  check(res, {
    'health status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
