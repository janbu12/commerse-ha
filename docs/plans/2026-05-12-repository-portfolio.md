# Repository Portfolio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Initialize Git and prepare this Fastify HA e-commerce backend as a portfolio-ready repository.

**Architecture:** This is a documentation and repository hygiene pass. The application remains a Fastify API with HAProxy, PostgreSQL, Redis, Prometheus, Grafana, Loki, Promtail, cAdvisor, node-exporter, postgres-exporter, redis-exporter, and a small container-name exporter.

**Tech Stack:** Node.js, TypeScript, Fastify, PostgreSQL, Redis, Docker Compose, HAProxy, Prometheus, Grafana, Loki, Vitest.

---

### Task 1: Repository Hygiene

**Files:**
- Modify: `.gitignore`
- Modify: `.dockerignore`

**Steps:**
1. Expand ignore rules for dependencies, build outputs, logs, temporary files, local env files, editor folders, Docker override files, and OS metadata.
2. Keep `.env.example` trackable.
3. Ensure Docker build context excludes local-only files but keeps source, package manifests, and needed config.
4. Verify with `git status --short --ignored`.
5. Commit as `chore: initialize repository hygiene`.

### Task 2: Portfolio README

**Files:**
- Modify: `README.md`

**Steps:**
1. Rewrite README with project overview, architecture, features, observability, local setup, testing, failover demo, and useful URLs.
2. Embed images from `docs/Untitled-2025-10-25-2007.png`, `docs/localhost_9090_targets_search=.png`, and `docs/localhost_3000_d_ecommerce-overview_ecommerce-overview_from=now-30m&to=now&timezone=browser&refresh=10s (2).png`.
3. Keep commands copy-paste friendly for Windows Git Bash and Linux/macOS.
4. Commit as `docs: add portfolio project overview`.

### Task 3: Baseline Source and Infrastructure

**Files:**
- Add source, tests, database migrations, Docker Compose, Dockerfile, and infrastructure configs.
- Add docs screenshots and planning docs.

**Steps:**
1. Stage application and infrastructure files separately from ignored artifacts.
2. Run `npm run build`, `npm test -- --testTimeout=60000`, `docker compose config --quiet`, and HAProxy config validation.
3. Commit remaining baseline as focused commits, keeping docs plans separate if practical.
