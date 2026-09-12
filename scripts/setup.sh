#!/usr/bin/env bash
# ─── Fathom 8x — One-Command Local Setup ─────────────────────────────────────
# Usage: bash scripts/setup.sh
#
# What it does:
#   1. Checks prerequisites (node, pnpm, docker)
#   2. Starts local Postgres via Docker Compose
#   3. Installs dependencies
#   4. Generates and runs DB migrations
#   5. Seeds demo data
#   6. Prints the dev URL
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}▶ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
err()  { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

log "Fathom 8x — local setup"

# ─── Prerequisites ────────────────────────────────────────────────────────────
command -v node &>/dev/null || err "Node.js is required. Install from https://nodejs.org"
command -v pnpm &>/dev/null || err "pnpm is required. Run: npm install -g pnpm"
command -v docker &>/dev/null || err "Docker is required. Install from https://docker.com"

NODE_VER=$(node -e "process.stdout.write(process.version.split('.')[0].slice(1))")
if [ "$NODE_VER" -lt 20 ]; then
  err "Node.js 20+ is required. Current: $(node -v)"
fi

log "Node $(node -v) / pnpm $(pnpm -v)"

# ─── Env file ─────────────────────────────────────────────────────────────────
if [ ! -f .env.local ]; then
  warn ".env.local not found — copying from template"
  cp .env.example .env.local 2>/dev/null || true
  warn "Edit .env.local before adding real API keys"
fi

# Load env vars for this script
set -a
# shellcheck source=/dev/null
[ -f .env.local ] && source .env.local
set +a

# ─── Docker Postgres ──────────────────────────────────────────────────────────
log "Starting Postgres (Docker)…"
docker compose up -d postgres

log "Waiting for Postgres to be healthy…"
for i in {1..30}; do
  if docker compose exec -T postgres pg_isready -U fathom -d fathom_dev -q 2>/dev/null; then
    break
  fi
  if [ "$i" = "30" ]; then
    err "Postgres did not become healthy in 30s. Check: docker compose logs postgres"
  fi
  sleep 1
done
log "Postgres is ready"

# ─── Install deps ─────────────────────────────────────────────────────────────
log "Installing dependencies…"
pnpm install

# ─── DB migrations ────────────────────────────────────────────────────────────
log "Generating Drizzle migrations…"
pnpm --filter @fathom/db generate

log "Enabling pgvector extension…"
docker compose exec -T postgres psql -U fathom -d fathom_dev \
  -c "CREATE EXTENSION IF NOT EXISTS vector;" -q 2>/dev/null || true

log "Running migrations…"
pnpm --filter @fathom/db migrate

# ─── Seed demo data ───────────────────────────────────────────────────────────
log "Seeding demo data (10 meetings + hero transcript)…"
pnpm seed:demo

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Fathom 8x is ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Start dev server:   pnpm dev"
echo "  Open:               http://localhost:3000"
echo "  Sign in:            Use the amber 'Dev Sign-In' panel (no Google needed)"
echo "  Demo (no login):    http://localhost:3000/demo"
echo ""
echo "  When you have real API keys, add them to .env.local and set:"
echo "    USE_MOCK_INTEGRATIONS=false"
echo "    DEV_AUTH_BYPASS=false  (once GOOGLE_CLIENT_ID is set)"
echo ""
