# PostgreSQL Automatic Failover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic PostgreSQL failover to the Docker Compose stack without changing the application code.

**Architecture:** Use Bitnami PostgreSQL with repmgr for primary/standby management and Bitnami Pgpool as the stable database endpoint. API containers connect to Pgpool instead of a specific PostgreSQL node.

**Tech Stack:** Docker Compose, Bitnami `postgresql-repmgr`, Bitnami `pgpool`, PostgreSQL 16, Fastify API, Prometheus postgres-exporter.

---

### Task 1: Update Compose Database Topology

**Files:**
- Modify: `docker-compose.yml`

**Steps:**
1. Replace `postgres-master` with `postgres-primary` using `bitnamilegacy/postgresql-repmgr:16`.
2. Replace `postgres-replica` with `postgres-standby` using `bitnamilegacy/postgresql-repmgr:16`.
3. Add `postgres-pgpool` using `bitnamilegacy/pgpool:4`.
4. Point all API `DATABASE_URL` values to `postgres-pgpool`.
5. Point `postgres-exporter` to `postgres-pgpool`.
6. Rename database volumes to match the new services.

### Task 2: Update Environment Example

**Files:**
- Modify: `.env.example`

**Steps:**
1. Change `DATABASE_URL` to use `postgres-pgpool`.
2. Keep `DATABASE_REPLICA_URL` documented for direct replica experiments.

### Task 3: Validate Configuration

**Commands:**
- `docker compose config`
- `docker compose up -d postgres-primary postgres-standby postgres-pgpool`
- `docker compose up -d ecommerce-api-1 ecommerce-api-2 ecommerce-api-3 haproxy postgres-exporter`

**Expected:**
- Compose config renders without errors.
- Pgpool becomes healthy.
- API health via HAProxy returns `200`.

### Task 4: Verify Failover

**Commands:**
- `docker compose stop postgres-primary`
- Poll `curl http://localhost/health`
- Run a write operation through the API after promotion.
- Check `pg_is_in_recovery()` through Pgpool.

**Expected:**
- API may have a short transient failure window.
- API returns to `200` without changing `DATABASE_URL`.
- The promoted standby accepts writes.

