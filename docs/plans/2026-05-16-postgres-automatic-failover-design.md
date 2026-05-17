# PostgreSQL Automatic Failover Design

**Goal:** Keep the API available when the active PostgreSQL primary goes down in the Docker Compose stack.

**Scope:** Docker Compose only. `podman-compose.yml` stays unchanged.

## Architecture

Replace the direct `postgres-master` and `postgres-replica` setup with a small repmgr cluster fronted by Pgpool:

```text
API instances -> postgres-pgpool -> active PostgreSQL primary
                                -> standby PostgreSQL node
```

The standby starts as a read-only replica. If the primary fails, repmgr promotes the standby to primary. Pgpool keeps a stable hostname for the API, so `DATABASE_URL` points to `postgres-pgpool` instead of a single database node.

## Components

- `postgres-primary`: initial primary node, seeded from `database/init`.
- `postgres-standby`: initial standby node, read-only until promoted.
- `postgres-pgpool`: database proxy used by API containers.
- `postgres-exporter`: connects through Pgpool so monitoring follows the writable database endpoint.

## Data Flow

Normal state:

```text
API write -> Pgpool -> postgres-primary
postgres-primary WAL -> postgres-standby
```

Failover state:

```text
postgres-primary stops
repmgr promotes postgres-standby
API write -> Pgpool -> postgres-standby
```

## Caveats

Failover is not instant. Requests during promotion can fail for a few seconds. Bringing the old primary back as a standby may require a rejoin/reclone flow; this design targets an automatic primary outage demo, not full production-grade failback.

