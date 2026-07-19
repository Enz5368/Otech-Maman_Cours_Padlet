#!/bin/sh
set -eu

python scripts/migrate.py
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="${MEP_TRUSTED_PROXY_IPS:-*}"

