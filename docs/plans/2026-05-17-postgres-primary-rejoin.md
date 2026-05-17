# PostgreSQL Primary Rejoin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a safe controlled rejoin flow so the old `postgres-primary` can return as a standby after `postgres-standby` has been promoted.

**Architecture:** Do not implement automatic failback. Provide an explicit operator script that removes stale `postgres-primary` state, starts it again, lets repmgr clone from the current primary, and asks Pgpool to reattach the node.

**Tech Stack:** Bash, Docker Compose, Bitnami PostgreSQL repmgr, Bitnami Pgpool.

---

### Task 1: Add Rejoin Script

**Files:**
- Create: `scripts/postgres-rejoin-primary.sh`

**Steps:**
1. Detect Docker CLI through `DOCKER_BIN`, `docker`, or Docker Desktop's Windows binary.
2. Confirm `postgres-standby` is currently primary before doing destructive work.
3. Stop and remove `postgres-primary`.
4. Remove the `postgres-primary-data` volume so stale timeline data cannot rejoin unsafely.
5. Start `postgres-primary`.
6. Wait until it reports `pg_is_in_recovery() = true`.
7. Recreate Pgpool so its backend status includes the rejoined node.
8. Print `SHOW pool_nodes;`.

### Task 2: Document Failback/Rejoin

**Files:**
- Modify: `README.md`

**Steps:**
1. Clarify that automatic failback is intentionally not used.
2. Document the safe rejoin command.
3. Show expected final state: `postgres-standby` remains primary and `postgres-primary` becomes standby.

### Task 3: Verify

**Commands:**
- `bash -n scripts/postgres-rejoin-primary.sh`
- `docker compose config`
- Optional live test when Docker daemon is running:
  - `./scripts/postgres-rejoin-primary.sh`
  - `SHOW pool_nodes;`

