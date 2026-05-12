# AI Agent Context Document
# E-Commerce Backend System — High Availability Architecture

**Document Type:** Agent Knowledge Base / System Context  
**Version:** 1.2.0  
**Domain:** Backend Engineering — E-Commerce  
**Purpose:** Memberikan konteks lengkap kepada AI agent tentang arsitektur, masalah, solusi, dan batasan sistem backend e-commerce ini.

---

## 1. IDENTITAS SISTEM

| Atribut | Detail |
|---|---|
| Nama Sistem | E-Commerce Backend API |
| Tipe | RESTful Backend Service |
| Stack Utama | Fastify / TypeScript, PostgreSQL, Redis, HAProxy |
| Deployment | Docker Compose (multi-instance) |
| Pola Arsitektur | Modular Monolith dengan Load Balancing |
| Status | Planning → Implementation |

---

## 2. KONTEKS DAN LATAR BELAKANG

### 2.1 Kondisi Awal (Before State)

Sistem sebelumnya berjalan pada **satu instance backend tunggal** dengan semua request diarahkan ke satu service yang sama. Kondisi ini menciptakan berbagai kerentanan yang muncul saat traffic meningkat, terutama pada event seperti:

- Flash sale
- Promo bulanan
- Campaign tertentu

### 2.2 Masalah Yang Teridentifikasi

#### Problem 1 — Single Point of Failure
- Satu instance backend = jika mati, seluruh fitur ikut mati
- Fitur yang terdampak: login, lihat produk, checkout, pembayaran, order tracking
- Dampak bisnis: kehilangan revenue, pengalaman user buruk, developer tidak bisa maintenance tanpa downtime

#### Problem 2 — Beban Request Tidak Terdistribusi
- Semua request ke satu instance
- Gejala saat traffic tinggi: response lambat, timeout, CPU tinggi, memory tinggi, request gagal
- Titik kritis: endpoint `/products` dan `/checkout` menerima lonjakan bersamaan

#### Problem 3 — Checkout Rentan Gagal
- Checkout adalah proses kritikal multi-langkah
- Risiko tanpa transaction: race condition stok, double order, stok minus, pembayaran sukses tapi order gagal, order dibuat tapi payment gagal

#### Problem 4 — Tidak Ada Health Check Otomatis
- Load balancer tidak tahu kondisi sebenarnya backend
- Instance bisa kelihatan hidup tapi database/Redis sudah putus
- Traffic tetap dikirim ke instance bermasalah

#### Problem 5 — Observability Lemah
- Tidak ada monitoring terpusat
- Sulit debug: endpoint lambat, instance error, query berat, container restart, sumber error tidak jelas

#### Problem 6 — Deployment Tidak Portable
- Dependency berbeda antar environment
- Konfigurasi manual dan tidak terdokumentasi
- Setup tidak konsisten

---

## 3. TUJUAN SISTEM (Goals)

Sistem yang dibangun harus memenuhi properti berikut:

| Properti | Deskripsi |
|---|---|
| High Availability | Sistem tetap berjalan meski satu instance down |
| Load Balancing | Traffic didistribusikan merata ke semua instance |
| Automatic Failover | Instance unhealthy otomatis dikeluarkan dari pool |
| Active Health Check | Endpoint `/health` mengecek dependency riil, bukan hanya proses |
| Checkout Reliability | Proses checkout atomic menggunakan database transaction |
| Database Consistency | Tidak ada data setengah jadi atau stok minus |
| Centralized Logging | Log dari semua instance bisa dibaca dari satu tempat |
| Metrics Monitoring | Dashboard real-time untuk semua komponen sistem |
| Portable Deployment | Bisa dijalankan di environment baru dengan satu perintah |
| Maintainable Architecture | Struktur kode modular, mudah dikembangkan |

---

## 4. ARSITEKTUR SISTEM

### 4.1 Topology

```
Client / API Consumer
        ↓
HAProxy Load Balancer  (port 80 / 443)
        ↓
┌────────────────────────────────┐
│       Backend API Instances    │
│  ecommerce-api-1  (port 3001)  │
│  ecommerce-api-2  (port 3002)  │
│  ecommerce-api-3  (port 3003)  │
└────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│             Redis               │
│  - Cache layer (product data)   │
│  - Job queue (notifications)    │
│  - Rate limiting                │
└─────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────┐
│            PostgreSQL Cluster                │
│                                              │
│  postgres-master  (port 5432) ← Write/Read  │
│    ↓ streaming replication                   │
│  postgres-replica (port 5433) ← Read/Standby│
└──────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│          Observability          │
│  Prometheus → Grafana           │
│  Loki ← Promtail                │
│  cAdvisor, Node Exporter        │
│  PostgreSQL Exporter            │
└─────────────────────────────────┘
```

### 4.2 Komponen dan Peran

| Komponen | Peran | Port (default) |
|---|---|---|
| HAProxy | Load balancer, health check, failover | 80 |
| ecommerce-api-1/2/3 | Backend API instances | 3001–3003 |
| postgres-master | Database utama, menerima semua write dan read | 5432 |
| postgres-replica | Standby replica, streaming replication dari master, dipakai read + failover | 5433 |
| Redis | Cache + Job queue | 6379 |
| Prometheus | Metrics scraping dan storage | 9090 |
| Grafana | Dashboard visualisasi | 3000 |
| Loki | Log aggregation | 3100 |
| Promtail | Log shipping agent | — |
| cAdvisor | Container metrics | 8080 |
| Node Exporter | Host metrics | 9100 |
| postgres-exporter | PostgreSQL metrics | 9187 |

---

## 5. DATABASE SCHEMA

### 5.1 Entitas Utama

```
users
  id, email, password_hash, name, phone, created_at

products
  id, name, description, price, category_id, created_at

product_variants
  id, product_id, sku, size, color, price

inventory
  id, product_variant_id, stock_quantity, reserved_quantity

carts
  id, user_id, created_at, updated_at

cart_items
  id, cart_id, product_variant_id, quantity

orders
  id, user_id, status, total_amount, created_at
  status: pending_payment | paid | processing | shipped | completed | cancelled | expired

order_items
  id, order_id, product_variant_id, quantity, unit_price

payments
  id, order_id, payment_reference, gateway, amount, status, created_at
  status: pending | success | failed | expired | refunded

shipments
  id, order_id, tracking_number, courier, status, shipped_at
```

### 5.2 Konfigurasi PostgreSQL Master-Replica

#### Topology Replikasi

```
postgres-master (port 5432)
  │
  │  Streaming Replication (WAL-based, async)
  ▼
postgres-replica (port 5433)
  - Hot Standby: bisa menerima read queries
  - Standby Failover: siap dipromosikan jadi master
```

#### Peran Masing-Masing Node

| Node | Peran | Menerima Write | Menerima Read | Bisa Jadi Master |
|---|---|---|---|---|
| postgres-master | Primary | Ya | Ya | Sudah master |
| postgres-replica | Hot Standby | Tidak | Ya (read-only) | Ya, saat failover |

#### Tipe Replikasi

- **Streaming Replication** — PostgreSQL built-in, WAL (Write-Ahead Log) dikirim dari master ke replica secara real-time
- **Mode Replica:** `hot_standby = on` → replica bisa menerima SELECT query
- **Replikasi bersifat asynchronous** — ada kemungkinan replica sedikit tertinggal (replication lag)

#### Aturan Routing Query di Backend

```
Write operations (INSERT, UPDATE, DELETE, transaction):
  → Selalu ke postgres-master

Read operations (SELECT):
  → Bisa ke postgres-master atau postgres-replica
  → Untuk data yang butuh konsistensi tinggi (stok, payment):
     gunakan postgres-master
  → Untuk data yang toleran eventual consistency (product list, order history):
     bisa menggunakan postgres-replica
```

#### Failover Scenario

```
Kondisi Normal:
  Backend → postgres-master (write + read)
  Backend → postgres-replica (read opsional)

Kondisi postgres-master Down:
  1. Deteksi master down (manual atau via tool monitoring)
  2. Promosikan replica menjadi master:
     docker exec postgres-replica pg_ctl promote
  3. Update DATABASE_URL di semua backend instance
  4. Restart backend atau reload konfigurasi
  5. postgres-replica kini menjadi master baru

Setelah Recovery:
  1. Jalankan kembali node lama sebagai replica baru
  2. Sinkronkan data dari master baru ke node lama
  3. Tambahkan kembali sebagai standby
```

> **Catatan:** Failover pada setup ini **tidak otomatis** — memerlukan intervensi manual atau tool tambahan seperti Patroni untuk automatic failover. Untuk scope project ini, manual failover sudah cukup.

#### Konfigurasi postgresql.conf (Master)

```ini
wal_level = replica
max_wal_senders = 3
wal_keep_size = 64MB
hot_standby = on
```

#### Konfigurasi recovery.conf / postgresql.conf (Replica)

```ini
hot_standby = on
primary_conninfo = 'host=postgres-master port=5432 user=replicator password=<pass>'
```

#### User Replikasi

```sql
-- Dibuat di master
CREATE USER replicator WITH REPLICATION LOGIN PASSWORD '<strong-password>';
```

---

### 5.3 Aturan Konsistensi Data

- Stok tidak boleh negatif → gunakan lock saat checkout
- Payment reference harus unik → unique constraint di database
- Order tidak boleh dibuat tanpa payment record yang valid
- Webhook idempoten → cek payment reference sebelum proses ulang

---

## 6. BUSINESS LOGIC KRITIS

### 6.1 Flow Checkout (Atomic Transaction)

```
POST /checkout

BEGIN TRANSACTION
  1. Validasi user session dan cart
  2. Validasi cart tidak kosong
  3. SELECT stok produk WITH FOR UPDATE LOCK
  4. Validasi stok mencukupi untuk semua item
  5. INSERT ke tabel orders (status: pending_payment)
  6. INSERT ke tabel order_items
  7. UPDATE inventory (kurangi stock_quantity)
  8. INSERT ke tabel payments (status: pending)
COMMIT

Setelah commit:
  9. Request payment URL ke payment gateway
  10. Masukkan job notifikasi ke Redis queue
  11. Return payment URL ke client

Jika langkah 1–8 gagal → ROLLBACK (tidak ada perubahan data)
Jika langkah 9 gagal → order tetap ada, status pending_payment, retry via job
```

**Hal yang TIDAK boleh dilakukan:**
- Mengurangi stok sebelum order dikonfirmasi
- Membuat order tanpa transaction
- Menganggap pembayaran berhasil sebelum ada webhook konfirmasi dari gateway

### 6.2 Flow Payment Webhook (Idempoten)

```
POST /webhook/payment

1. Validasi signature webhook menggunakan PAYMENT_WEBHOOK_SECRET
2. Ambil payment_reference dari payload
3. Cek apakah payment_reference sudah ada di database
4. Cek apakah status payment sudah bukan 'pending'
5. Jika sudah diproses → return 200 OK (jangan proses ulang)
6. Jika belum diproses:
   BEGIN TRANSACTION
     a. UPDATE payments SET status = 'success'
     b. UPDATE orders SET status = 'paid'
   COMMIT
7. Masukkan job notifikasi invoice ke Redis queue
8. Return 200 OK ke payment gateway
```

**Aturan wajib:**
- Selalu return 200 OK ke gateway meski sudah diproses (agar gateway tidak retry terus)
- Jangan pernah proses webhook yang sama dua kali
- Jangan update stok di webhook (sudah dikurangi saat checkout)

### 6.3 Cache Strategy (Redis)

| Data | TTL | Invalidasi |
|---|---|---|
| Product list | 5 menit | Saat ada update produk |
| Product detail | 10 menit | Saat produk diupdate |
| Category list | 30 menit | Saat ada update kategori |
| Promo aktif | 1 menit | Real-time sensitive |

Cache-aside pattern: cek Redis dulu → jika miss, query PostgreSQL → simpan ke Redis.

### 6.4 Job Queue (Redis)

Proses yang masuk queue (non-blocking):
- Kirim email invoice
- Kirim WhatsApp/SMS notification
- Update analytics
- Sync ke sistem eksternal
- Notifikasi status pembayaran

Proses yang TIDAK boleh masuk queue (harus synchronous):
- Validasi stok
- Pembuatan order
- Pengurangan stok
- Pembuatan payment record

---

## 7. API ENDPOINTS

### 7.1 Daftar Endpoint Utama

```
AUTH
  POST   /auth/register
  POST   /auth/login
  POST   /auth/logout
  POST   /auth/refresh

PRODUCTS
  GET    /products                  ← cache Redis
  GET    /products/:id              ← cache Redis
  GET    /products/:id/variants

CART
  GET    /cart
  POST   /cart/items
  PUT    /cart/items/:id
  DELETE /cart/items/:id

CHECKOUT
  POST   /checkout                  ← atomic transaction

ORDERS
  GET    /orders
  GET    /orders/:id

PAYMENTS
  GET    /payments/:id
  POST   /webhook/payment           ← idempoten, validasi signature

HEALTH
  GET    /health                    ← dipakai HAProxy health check
```

### 7.2 Endpoint /health — Kontrak Response

```json
// Healthy (HTTP 200)
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "uptime": 1200
}

// Unhealthy (HTTP 503)
{
  "status": "error",
  "database": "disconnected",
  "redis": "connected",
  "uptime": 980
}
```

HAProxy akan menandai instance sebagai unhealthy jika response bukan HTTP 200.

---

## 8. KONFIGURASI HAProxy

### 8.1 Behavior Load Balancing

- Algoritma: roundrobin (default)
- Health check interval: setiap 5 detik
- Instance dianggap down setelah 3 kali gagal health check
- Instance kembali ke pool setelah 2 kali berhasil health check
- Timeout connect: 5 detik
- Timeout client/server: 30 detik

### 8.2 Failover Behavior

```
Kondisi Normal:
  HAProxy → api-1, api-2, api-3 (semua menerima traffic)

Kondisi api-2 Down:
  HAProxy → api-1, api-3 (api-2 di-exclude otomatis)

Kondisi api-2 Pulih:
  HAProxy → api-1, api-2, api-3 (api-2 kembali masuk pool)
```

---

## 9. OBSERVABILITY

### 9.1 Metrics yang Dimonitor

**Backend API:**
- Request per second (RPS)
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Latency per endpoint

**Checkout & Payment:**
- Total checkout attempts
- Checkout success rate
- Checkout failure rate
- Payment pending count
- Payment success rate
- Payment failure rate

**Database (PostgreSQL):**
- Active connections
- Query duration
- Slow queries (> threshold)
- Transaction count
- Lock wait time
- Replication lag (master → replica)
- Replica sync status

**Redis:**
- Memory usage
- Cache hit ratio
- Queue length
- Connected clients

**Container (cAdvisor):**
- CPU usage per container
- Memory usage per container
- Restart count
- Health status

**Host (Node Exporter):**
- CPU usage
- RAM usage
- Disk usage
- Network traffic
- Uptime

### 9.2 Log Events Penting (Loki)

Log berikut wajib dikirim ke Loki:

| Event | Level | Keterangan |
|---|---|---|
| login_failed | WARN | Brute force detection |
| checkout_failed | ERROR | Dengan reason dan cart_id |
| payment_webhook_received | INFO | Dengan payment_reference |
| payment_validation_failed | ERROR | Signature mismatch |
| database_error | ERROR | Query gagal |
| redis_timeout | ERROR | Connection timeout |
| internal_server_error | ERROR | Stack trace |
| health_check_failed | ERROR | Dependency detail |
| postgres_failover_triggered | CRITICAL | Master down, replica dipromosikan |
| replication_lag_high | WARN | Lag > threshold (misal > 10 detik) |

---

## 10. ENVIRONMENT VARIABLES

### 10.1 Variabel yang Diperlukan

```env
# Application
NODE_ENV=production
APP_PORT=3001
APP_INSTANCE_ID=api-1

# Database
DATABASE_URL=postgresql://user:pass@postgres-master:5432/ecommerce
DATABASE_REPLICA_URL=postgresql://user:pass@postgres-replica:5433/ecommerce

# Redis
REDIS_URL=redis://redis:6379

# Auth — Access Token
JWT_SECRET=<strong-random-secret-min-32-chars>
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# Auth — Cookie
COOKIE_SECRET=<strong-random-secret-min-32-chars>
COOKIE_SECURE=true
COOKIE_SAME_SITE=Strict

# Auth — 2FA (Admin)
TOTP_ENCRYPTION_KEY=<strong-random-secret>

# Payment Gateway (Midtrans)
MIDTRANS_SERVER_KEY=<midtrans-server-key>
MIDTRANS_CLIENT_KEY=<midtrans-client-key>
MIDTRANS_WEBHOOK_SECRET=<midtrans-webhook-secret>
MIDTRANS_IS_PRODUCTION=false

# Rate Limiting
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_LOGIN_WINDOW_MS=60000

# Logging
LOG_LEVEL=info
LOKI_URL=http://loki:3100

# Monitoring
PROMETHEUS_PORT=9091
```

### 10.2 Aturan Environment

- `.env` → file asli, tidak boleh di-commit ke repository
- `.env.example` → template tanpa nilai sensitif, wajib ada di repository
- Tidak ada nilai hardcode di source code
- Setiap instance mendapat `APP_INSTANCE_ID` berbeda untuk keperluan log

---

## 11. STRUKTUR KODE

```
src/
  modules/
    auth/
      auth.route.ts
      auth.controller.ts
      auth.service.ts
      auth.schema.ts          ← Fastify JSON schema validation
      token.service.ts        ← access token + refresh token logic
      refresh-token.store.ts  ← revoke & rotasi refresh token (Redis)
      mfa.service.ts          ← TOTP 2FA untuk admin
      re-auth.service.ts      ← verifikasi ulang untuk endpoint sensitif
    users/
    products/
    carts/
    orders/
    payments/
      payment.route.ts
      payment.controller.ts
      payment.service.ts
      midtrans.client.ts      ← Midtrans SDK wrapper
      webhook.handler.ts      ← idempoten logic + signature validation
    inventory/
  shared/
    database/
      connection.ts           ← ORM connection (TBD: Prisma / Drizzle)
      transaction.ts          ← helper BEGIN/COMMIT/ROLLBACK
      replica.ts              ← routing read ke replica
    redis/
      cache.ts
      queue.ts                ← BullMQ producer
      rate-limit.ts           ← Redis-based rate limiter
    queue/
      workers/
        notification.worker.ts
        invoice.worker.ts
      jobs/
        notification.job.ts
        invoice.job.ts
    logger/
      logger.ts
      loki-transport.ts
    middleware/
      auth.middleware.ts       ← verifikasi access token dari cookie
      role.middleware.ts       ← validasi role/permission di backend
      rate-limit.middleware.ts
    errors/
      app-error.ts
      error-handler.ts
    plugins/                   ← Fastify plugins
      cookie.plugin.ts
      cors.plugin.ts
      rate-limit.plugin.ts
      swagger.plugin.ts
  config/
    app.config.ts
    database.config.ts
    auth.config.ts
    midtrans.config.ts
  metrics/
    prometheus.ts
    collectors/
  main.ts
  health.route.ts              ← endpoint /health
```

---

## 12. DOCKER COMPOSE SERVICES

```yaml
services:
  haproxy:
  ecommerce-api-1:
  ecommerce-api-2:
  ecommerce-api-3:
  postgres-master:        # Primary database, menerima semua write
  postgres-replica:       # Hot standby, streaming replication dari master
  redis:
  prometheus:
  grafana:
  loki:
  promtail:
  node-exporter:
  cadvisor:
  postgres-exporter:      # Diarahkan ke postgres-master
```

Semua service terhubung dalam network `ecommerce-network`.

---

## 13. IMPLEMENTATION PHASES

| Phase | Fokus | Output |
|---|---|---|
| Phase 1 | Core Backend | API modules, /health, checkout transaction |
| Phase 2 | Containerization | Dockerfile, docker-compose, multi-instance |
| Phase 3 | Load Balancing | HAProxy config, health check, failover test |
| Phase 4 | Reliability | Transaction checkout, idempoten webhook, cache, queue |
| Phase 5 | Observability | Prometheus, Grafana, Loki, exporters, dashboard |
| Phase 6 | Documentation | README, API docs, .env.example, failover scenario |

---

## 14. BATASAN DAN KEPUTUSAN DESAIN

### 14.1 Keputusan yang Sudah Ditetapkan (Tidak Perlu Didiskusikan Ulang)

- **HAProxy** dipilih sebagai load balancer (bukan Nginx karena fitur health check lebih granular)
- **PostgreSQL** dipilih untuk data transaksional (bukan MySQL atau NoSQL)
- **PostgreSQL Streaming Replication** dipilih untuk replikasi (built-in, tanpa dependency tambahan)
- **1 Master + 1 Replica** sebagai konfigurasi minimum HA database
- **Failover manual** (bukan automatic via Patroni) sesuai scope project ini
- **Redis** dipilih untuk cache dan queue (bukan RabbitMQ untuk menyederhanakan stack)
- **Docker Compose** dipilih untuk deployment (bukan Kubernetes karena scope portfolio)
- **Loki** dipilih untuk log (bukan ELK karena lebih ringan)
- **Tiga instance** backend sebagai minimum HA setup
- **Fastify** dipilih sebagai framework backend (bukan Express/NestJS — lebih cepat, built-in schema validation, TypeScript-first)
- **BullMQ** dipilih sebagai job queue library (aktif dikembangkan, fitur lengkap, requires Redis 6+)
- **Midtrans** dipilih sebagai payment gateway provider
- **Integration test** dipilih sebagai testing strategy utama
- **ORM** — belum ditentukan (lihat 14.2)

### 14.2 Hal yang Belum Ditentukan (Bisa Didiskusikan)

- **ORM** — Prisma vs Drizzle ORM (keduanya cocok dengan Fastify dan TypeScript; Prisma lebih mature, Drizzle lebih dekat ke SQL mentah dan lebih optimal untuk `FOR UPDATE LOCK`)

### 14.3 Keputusan Auth & Security (Sudah Ditetapkan)

Seluruh poin berikut adalah **wajib** dan tidak boleh dikompromikan:

| # | Aturan | Detail |
|---|---|---|
| 1 | Password harus di-hash | Tidak boleh ada plaintext password di database atau log |
| 2 | Algoritma hashing | Argon2id (diutamakan) atau bcrypt — pilih salah satu, konsisten |
| 3 | Rate limit login | Endpoint POST /auth/login wajib dibatasi, contoh: max 5 percobaan per IP per menit |
| 4 | Pesan error login generik | Selalu kembalikan "Email atau password salah" — jangan bedakan antara email tidak ditemukan vs password salah |
| 5 | Cookie HttpOnly + Secure + SameSite | Access token dan refresh token disimpan di cookie, bukan localStorage |
| 6 | Dilarang simpan token di localStorage | Rentan XSS — mutlak dilarang |
| 7 | Refresh token rotasi & revocable | Setiap refresh menghasilkan token baru, token lama diinvalidasi; revoke tersimpan di Redis atau database |
| 8 | Logout menghapus semua sesi | Cookie dihapus + refresh token di-revoke dari storage |
| 9 | Admin wajib 2FA/MFA | Role admin tidak bisa login hanya dengan password |
| 10 | Re-auth untuk endpoint sensitif | Ganti password, ganti email, tarik saldo → wajib verifikasi ulang identitas |
| 11 | HTTPS wajib | Semua komunikasi client-server harus melalui HTTPS |
| 12 | Validasi role/permission di backend | Frontend hanya untuk UI — otorisasi tidak boleh bergantung pada logika frontend |

#### Implementasi Auth Flow

```
Register:
  1. Validasi input (email format, password strength)
  2. Cek email belum terdaftar
  3. Hash password dengan Argon2id
  4. Simpan user ke database
  5. Return 201 Created (jangan auto-login setelah register)

Login:
  1. Rate limit check (max 5 req/menit per IP)
  2. Cari user by email
  3. Jika tidak ditemukan → return "Email atau password salah" (jangan beri tahu email tidak ada)
  4. Verifikasi password dengan Argon2id compare
  5. Jika salah → return "Email atau password salah" (jangan beri tahu password salah)
  6. Jika admin → cek 2FA token sebelum lanjut
  7. Generate access token (short-lived, misal 15 menit)
  8. Generate refresh token (long-lived, misal 7 hari)
  9. Simpan refresh token ke Redis/database (untuk revoke)
  10. Set cookie HttpOnly, Secure, SameSite=Strict

Refresh Token:
  1. Baca refresh token dari cookie
  2. Verifikasi token valid dan belum di-revoke
  3. Invalidasi refresh token lama (rotasi)
  4. Generate access token baru
  5. Generate refresh token baru
  6. Update storage, set cookie baru

Logout:
  1. Baca refresh token dari cookie
  2. Revoke refresh token dari Redis/database
  3. Hapus semua cookie (set expired)
  4. Return 200 OK

Re-auth (endpoint sensitif):
  1. User sudah login (access token valid)
  2. Minta konfirmasi password lagi
  3. Verifikasi password
  4. Jika valid → izinkan akses ke endpoint sensitif (berikan short-lived re-auth token)
  5. Jika tidak valid → tolak dengan 403
```

#### Token Storage

```
Access Token:
  - Disimpan di: HttpOnly Cookie
  - TTL: 15 menit
  - Tidak boleh diakses via JavaScript (HttpOnly)

Refresh Token:
  - Disimpan di: HttpOnly Cookie (client) + Redis/DB (server, untuk revoke)
  - TTL: 7 hari
  - Wajib dirotasi setiap kali digunakan

2FA Secret (Admin):
  - Disimpan di: Database (terenkripsi)
  - Metode: TOTP (Time-based One-Time Password, misal via Google Authenticator)
```

### 14.4 Anti-Pattern yang DILARANG

- Mengurangi stok di luar transaction checkout
- Memproses webhook tanpa validasi signature
- Menyimpan secret di source code
- Mengakses database langsung dari controller (bypass service layer)
- Cache tanpa TTL
- Log tanpa structured format (gunakan JSON log)
- Tidak ada error handling di job queue
- Menyimpan password dalam bentuk plaintext atau dengan hashing lemah (MD5, SHA1)
- Menyimpan token di localStorage atau sessionStorage
- Mengembalikan pesan error login yang spesifik (membedakan email vs password salah)
- Validasi permission hanya di frontend
- Endpoint sensitif tanpa re-auth

---

## 15. SKENARIO PENGUJIAN

**Testing strategy yang ditetapkan: Integration Test**

Integration test dipilih karena sistem ini sangat bergantung pada interaksi antar komponen (database transaction, Redis cache, BullMQ queue, Midtrans webhook). Unit test saja tidak cukup untuk membuktikan correctness di skenario nyata.

### Setup Integration Test

```
Tools:
  - Test runner: Vitest atau Jest
  - Database: PostgreSQL test instance (terpisah dari development)
  - Redis: Redis test instance
  - HTTP client: Fastify inject() (built-in, tanpa HTTP round-trip)
  - Mocking: Hanya untuk Midtrans API dan external services

Prinsip:
  - Setiap test suite membersihkan database sebelum dan sesudah run
  - Tidak boleh ada shared state antar test
  - Test harus bisa dijalankan secara paralel (gunakan database schema terpisah per worker)
  - Tidak mock database atau Redis — gunakan instance asli
```

### 15.1 Auth Integration Tests

```
POST /auth/register
  ✓ Berhasil registrasi dengan data valid
  ✓ Gagal jika email sudah terdaftar
  ✓ Gagal jika format email tidak valid
  ✓ Gagal jika password terlalu lemah
  ✓ Password tersimpan sebagai hash (bukan plaintext) di database

POST /auth/login
  ✓ Berhasil login, mendapat cookie HttpOnly
  ✓ Gagal dengan email tidak terdaftar → pesan "Email atau password salah"
  ✓ Gagal dengan password salah → pesan "Email atau password salah"
  ✓ Pesan error tidak membedakan antara email vs password salah
  ✓ Rate limit aktif setelah 5 percobaan gagal dalam 1 menit
  ✓ Cookie berisi HttpOnly, Secure, SameSite flag
  ✓ Token tidak muncul di response body

POST /auth/refresh
  ✓ Berhasil refresh, mendapat token baru
  ✓ Refresh token lama tidak bisa dipakai lagi (rotasi)
  ✓ Gagal jika refresh token sudah di-revoke

POST /auth/logout
  ✓ Cookie dihapus
  ✓ Refresh token di-revoke dari Redis
  ✓ Refresh token lama tidak bisa dipakai lagi

Admin 2FA:
  ✓ Admin tidak bisa login tanpa TOTP code
  ✓ Login gagal jika TOTP code salah
  ✓ Login berhasil dengan TOTP code valid
```

### 15.2 Failover Test

```
1. Jalankan semua instance: docker compose up
2. Verifikasi semua instance healthy di HAProxy stats
3. Matikan satu instance: docker stop ecommerce-api-2
4. Tunggu health check interval HAProxy (5 detik)
5. Kirim request ke HAProxy → harus tetap berhasil
6. Verifikasi traffic hanya ke api-1 dan api-3
7. Nyalakan kembali api-2: docker start ecommerce-api-2
8. Tunggu recovery interval
9. Verifikasi api-2 kembali menerima traffic
```

### 15.3 Checkout Integration Tests

```
POST /checkout
  ✓ Berhasil checkout, order terbuat dengan status pending_payment
  ✓ Stok berkurang sesuai jumlah item
  ✓ Payment record terbuat dengan status pending
  ✓ Job notifikasi masuk ke BullMQ queue
  ✓ Midtrans payment URL dikembalikan ke client

Concurrency Test (stok = 1, 10 concurrent request):
  ✓ Hanya 1 order berhasil terbuat
  ✓ Stok = 0, tidak minus
  ✓ 9 request lain mendapat error "insufficient stock"
  ✓ Tidak ada double order di database

Gagal scenario:
  ✓ Gagal jika cart kosong
  ✓ Gagal jika stok tidak mencukupi
  ✓ Rollback sempurna — tidak ada order setengah jadi jika proses gagal di tengah
```

### 15.4 Webhook Idempotency Tests

```
POST /webhook/payment (Midtrans callback)
  ✓ Berhasil memproses webhook valid pertama kali
  ✓ Order berubah ke status paid
  ✓ Payment berubah ke status success
  ✓ Job invoice masuk ke BullMQ queue

  ✓ Webhook sama dikirim kedua kali → return 200 OK tanpa proses ulang
  ✓ Tidak ada duplikat update di database
  ✓ Tidak ada job duplikat di queue

  ✓ Webhook dengan signature tidak valid → ditolak 401
  ✓ Webhook untuk payment_reference tidak dikenal → ditolak 404
```

### 15.5 PostgreSQL Failover Test

```
1. Verifikasi replica dalam kondisi streaming:
   docker exec postgres-replica psql -U postgres -c "SELECT * FROM pg_stat_wal_receiver;"

2. Matikan postgres-master:
   docker stop postgres-master

3. Promosikan replica menjadi master:
   docker exec postgres-replica pg_ctl promote -D /var/lib/postgresql/data

4. Update DATABASE_URL di semua backend instance ke postgres-replica

5. Restart backend instances

6. Verifikasi write query diterima node baru:
   INSERT ke tabel orders harus berhasil

7. Catat replication lag yang terjadi sebelum failover:
   SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

---

## 16. GLOSARIUM

| Istilah | Definisi |
|---|---|
| Atomic | Proses yang harus berhasil seluruhnya atau gagal seluruhnya |
| Failover | Perpindahan otomatis ke instance lain saat ada instance down |
| Health Check | Pemeriksaan kondisi instance secara aktif oleh load balancer |
| Idempoten | Operasi yang menghasilkan hasil sama meski dieksekusi berkali-kali |
| Race Condition | Kondisi di mana dua proses mengakses data yang sama secara bersamaan |
| FOR UPDATE LOCK | Perintah SQL untuk mengunci baris agar tidak bisa diubah proses lain dalam transaction |
| Cache Hit | Data ditemukan di cache, tidak perlu query database |
| Cache Miss | Data tidak ada di cache, perlu query database |
| Dead Letter Queue | Queue untuk job yang gagal diproses berulang kali |
| Argon2id | Algoritma hashing password yang direkomendasikan — tahan terhadap brute force dan side-channel attack |
| TOTP | Time-based One-Time Password — kode 6 digit yang berubah tiap 30 detik, dipakai untuk 2FA |
| HttpOnly Cookie | Cookie yang tidak bisa diakses via JavaScript — mencegah token dicuri lewat XSS |
| Token Rotasi | Setiap kali refresh token digunakan, token lama diinvalidasi dan token baru diterbitkan |
| Re-auth | Verifikasi ulang identitas user sebelum mengakses endpoint sensitif |
| BullMQ | Library job queue berbasis Redis untuk Node.js — mengelola background jobs |
| Midtrans | Payment gateway Indonesia — menangani pembayaran dan mengirim webhook konfirmasi |
| Fastify | Web framework Node.js yang cepat dengan built-in JSON schema validation |
| WAL (Write-Ahead Log) | Log perubahan data di PostgreSQL yang digunakan sebagai dasar replikasi |
| Hot Standby | Mode replica yang tetap bisa menerima read query sambil menerima replikasi |
| Promote | Proses mengangkat replica menjadi master baru saat master utama down |
| Replication Lag | Selisih waktu antara data di master dan data yang sudah sampai di replica |

---

*Dokumen ini digunakan sebagai sumber kebenaran (source of truth) bagi AI agent yang membantu implementasi sistem ini. Setiap keputusan implementasi harus mengacu pada constraints dan decisions yang tercatat di sini.*
