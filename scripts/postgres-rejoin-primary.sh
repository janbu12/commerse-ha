#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-commerce-ha}"
PRIMARY_SERVICE="${PRIMARY_SERVICE:-postgres-primary}"
STANDBY_SERVICE="${STANDBY_SERVICE:-postgres-standby}"
PGPOOL_SERVICE="${PGPOOL_SERVICE:-postgres-pgpool}"
DB_USER="${DB_USER:-ecommerce}"
DB_NAME="${DB_NAME:-ecommerce}"
DB_PASSWORD="${DB_PASSWORD:-ecommerce_password}"
PRIMARY_VOLUME="${PRIMARY_VOLUME:-${PROJECT_NAME}_postgres-primary-data}"
WAIT_SECONDS="${WAIT_SECONDS:-180}"

find_docker() {
  if [[ -n "${DOCKER_BIN:-}" ]]; then
    printf '%s\n' "$DOCKER_BIN"
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    printf '%s\n' docker
    return
  fi

  local docker_desktop="/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
  if [[ -x "$docker_desktop" ]]; then
    printf '%s\n' "$docker_desktop"
    return
  fi

  printf 'docker CLI not found. Set DOCKER_BIN to your docker executable.\n' >&2
  exit 1
}

docker_bin="$(find_docker)"
compose=("$docker_bin" compose)

run_psql() {
  local service="$1"
  local sql="$2"

  "${compose[@]}" exec -T \
    -e "PGPASSWORD=${DB_PASSWORD}" \
    "$service" \
    psql -U "$DB_USER" -d "$DB_NAME" -Atc "$sql"
}

wait_for_query() {
  local service="$1"
  local sql="$2"
  local expected="$3"
  local elapsed=0

  until [[ "$elapsed" -ge "$WAIT_SECONDS" ]]; do
    local output
    output="$(run_psql "$service" "$sql" 2>/dev/null | tr -d '[:space:]' || true)"
    if [[ "$output" == "$expected" ]]; then
      return 0
    fi

    sleep 3
    elapsed=$((elapsed + 3))
  done

  printf 'Timed out waiting for %s to return %s for query: %s\n' "$service" "$expected" "$sql" >&2
  return 1
}

printf 'Checking that %s is already promoted to primary...\n' "$STANDBY_SERVICE"
standby_recovery="$(run_psql "$STANDBY_SERVICE" 'SELECT pg_is_in_recovery();' | tr -d '[:space:]')"
if [[ "$standby_recovery" != "f" ]]; then
  printf '%s is not primary yet. Refusing to remove %s data.\n' "$STANDBY_SERVICE" "$PRIMARY_SERVICE" >&2
  printf 'Expected pg_is_in_recovery() = f, got: %s\n' "$standby_recovery" >&2
  exit 1
fi

printf 'Stopping and removing stale %s container...\n' "$PRIMARY_SERVICE"
"${compose[@]}" rm -sf "$PRIMARY_SERVICE" >/dev/null

printf 'Removing stale volume %s...\n' "$PRIMARY_VOLUME"
"$docker_bin" volume rm "$PRIMARY_VOLUME" >/dev/null 2>&1 || true

printf 'Starting %s so repmgr can clone it from the current primary...\n' "$PRIMARY_SERVICE"
"${compose[@]}" up -d "$PRIMARY_SERVICE"

printf 'Waiting for %s to rejoin as standby...\n' "$PRIMARY_SERVICE"
wait_for_query "$PRIMARY_SERVICE" 'SELECT pg_is_in_recovery();' 't'

printf 'Recreating %s so backend status is refreshed...\n' "$PGPOOL_SERVICE"
"${compose[@]}" up -d --force-recreate "$PGPOOL_SERVICE"

printf 'Waiting for %s to become healthy...\n' "$PGPOOL_SERVICE"
elapsed=0
until [[ "$elapsed" -ge "$WAIT_SECONDS" ]]; do
  status="$("${compose[@]}" ps "$PGPOOL_SERVICE" --format '{{.Status}}' 2>/dev/null || true)"
  if [[ "$status" == *healthy* ]]; then
    break
  fi

  sleep 3
  elapsed=$((elapsed + 3))
done

if [[ "$elapsed" -ge "$WAIT_SECONDS" ]]; then
  printf 'Timed out waiting for %s to become healthy.\n' "$PGPOOL_SERVICE" >&2
  exit 1
fi

printf 'Current Pgpool node status:\n'
"${compose[@]}" exec -T \
  -e "PGPASSWORD=${DB_PASSWORD}" \
  "$PGPOOL_SERVICE" \
  psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c 'SHOW pool_nodes;'

