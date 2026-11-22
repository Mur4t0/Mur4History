#!/bin/sh
set -e

mkdir -p /app/prisma/data

if [ ! -f /app/prisma/data/dev.db ]; then
  echo "[Mur4History] Initializing SQLite database..."
  npx prisma db push --skip-generate
  npx tsx prisma/seed.ts
else
  npx prisma db push --skip-generate >/dev/null 2>&1 || true
fi

exec npm run start
