#!/bin/sh
set -e

# Run any pending Prisma migrations on startup
npx prisma migrate deploy

exec node server.js
