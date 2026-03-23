#!/bin/bash
set -e

echo "Starting SurrealDB..."
surreal start --user root --pass root --bind 0.0.0.0:8000 memory &

echo "Waiting for SurrealDB..."
sleep 2

echo "Applying schema..."
surreal sql --endpoint http://127.0.0.1:8000 --username root --password root --namespace clera --database matchmaking < supabase/surreal_schema.surql

echo "Seeding data..."
node --experimental-strip-types --experimental-vm-modules supabase/seed_surreal.ts

echo "Done — SurrealDB ready"
