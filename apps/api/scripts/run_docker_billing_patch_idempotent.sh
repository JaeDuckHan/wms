#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.docker}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "[error] docker compose file not found: $COMPOSE_FILE"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[error] env file not found: $ENV_FILE"
  echo "usage: $0 [.env.docker]"
  exit 1
fi

echo "[info] applying billing runtime patches with env: $ENV_FILE"

docker compose --env-file "$ENV_FILE" exec -T db \
  sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  < apps/api/sql/patch_billing_invoice_engine.sql

docker compose --env-file "$ENV_FILE" exec -T db \
  sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  < apps/api/sql/patch_multi_warehouse_billing_storage.sql

docker compose --env-file "$ENV_FILE" exec -T db \
  sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  < apps/api/sql/patch_warehouse_default_cbm_rate.sql

echo "[ok] runtime patches applied (idempotent): billing + warehouse default cbm columns."
