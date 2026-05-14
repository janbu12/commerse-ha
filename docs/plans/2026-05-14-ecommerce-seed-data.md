# E-Commerce Seed Data Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the minimal seed data with realistic demo e-commerce data for portfolio use.

**Architecture:** Keep the seed inside `database/init/002_seed.sql` so Docker Compose initializes PostgreSQL with deterministic catalog, cart, order, payment, and shipment data. Use fixed UUIDs for demo users and stable SKUs so README commands and manual checks remain reproducible.

**Tech Stack:** PostgreSQL SQL seed script, Docker Compose PostgreSQL container, Fastify checkout endpoint.

---

### Task 1: Expand Seed Data

**Files:**
- Modify: `database/init/002_seed.sql`

**Steps:**
1. Replace random UUID and random inventory values with deterministic UUIDs and stock values.
2. Add multiple customers, categories, products, variants, inventory rows, demo carts, historical orders, payments, and shipments.
3. Keep the README demo user id `00000000-0000-0000-0000-000000000001`.
4. Validate SQL by applying `001_schema.sql` and `002_seed.sql` against PostgreSQL.
5. Verify row counts and checkout compatibility.
6. Commit only the seed and plan changes.
