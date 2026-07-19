#!/usr/bin/env bash
#
# deploy.sh — promote the `dev` branch to `main` (prod) on this host.
#
# Flow (user-initiated, never automatic):
#   1. sanity-check both worktrees are clean
#   2. fast-forward `main` to `dev` in the .main worktree (refuses non-ff)
#   3. install deps + run production bundle build
#   4. restart the systemd service and health-check it
#
# The systemd unit is expected to already exist (one-time provisioning).
# Run this from the `dev` worktree:  ./scripts/deploy.sh
#
set -euo pipefail

SERVICE="portfolio-frontend.service"
SOURCE_BRANCH="dev"
TARGET_BRANCH="main"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MAIN_DIR="$(cd "$DEV_DIR/.." && pwd)/.main"

log()  { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
die()  { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
ok()   { printf '\033[32m✓ %s\033[0m\n' "$*"; }

# ── Preconditions ────────────────────────────────────────────────────
# This script is tracked, so a copy ff-syncs into the .main worktree on every
# deploy. Always run the `dev` copy: running the .main copy would let the deploy
# rewrite this very file mid-execution (bash reads scripts as they run). The
# guard below makes the .main copy inert — it exits before any side effect.
[ "$(basename "$DEV_DIR")" = "dev" ] || die "Run this from the 'dev' worktree (got: $DEV_DIR)."
[ -d "$MAIN_DIR" ] || die "main worktree not found at $MAIN_DIR"
systemctl cat "$SERVICE" >/dev/null 2>&1 \
  || die "systemd unit '$SERVICE' not found. Provision it once before deploying (see docs/deployment.md)."

git -C "$DEV_DIR" diff --quiet && git -C "$DEV_DIR" diff --cached --quiet \
  || die "dev worktree has uncommitted changes; commit or stash first."
git -C "$MAIN_DIR" diff --quiet && git -C "$MAIN_DIR" diff --cached --quiet \
  || die ".main worktree has uncommitted changes — it must never be edited by hand."

# ── Fast-forward main → dev ──────────────────────────────────────────
# Target must be a strict ancestor of source, or a ff is impossible.
git -C "$MAIN_DIR" merge-base --is-ancestor "$TARGET_BRANCH" "$SOURCE_BRANCH" \
  || die "'$TARGET_BRANCH' has diverged from '$SOURCE_BRANCH'; refusing non-fast-forward deploy."

if git -C "$MAIN_DIR" diff --quiet "$TARGET_BRANCH" "$SOURCE_BRANCH"; then
  log "Already up to date — $TARGET_BRANCH == $SOURCE_BRANCH"
else
  log "Fast-forwarding $TARGET_BRANCH → $SOURCE_BRANCH"
  git -C "$MAIN_DIR" merge --ff-only "$SOURCE_BRANCH"
fi
ok "$TARGET_BRANCH at $(git -C "$MAIN_DIR" rev-parse --short HEAD)"

# ── Dependencies ─────────────────────────────────────────────────────
log "Installing dependencies (.main)"
( cd "$MAIN_DIR" && bun install --frozen-lockfile )
( cd "$MAIN_DIR" && bun run agentime:status --require registry ) \
  || die "production dependencies are not in Agentime registry mode"

# ── Production build (Next.js) ───────────────────────────────────────
# NEXT_PUBLIC_WS_URL is baked into the bundle at build time, so
# build runs using .env.local values inside .main
log "Building production bundles (.main)"
( cd "$MAIN_DIR" && bun run build )

# ── Restart service ──────────────────────────────────────────────────
log "Restarting $SERVICE"
sudo systemctl restart "$SERVICE"

# ── Health check ─────────────────────────────────────────────────────
# Reads PORT from .env.local, defaults to 3000
PORT="$(grep -E '^PORT=' "$MAIN_DIR/.env.local" | cut -d= -f2)"; PORT="${PORT:-3000}"
log "Health check on http://localhost:$PORT/"
for _ in $(seq 1 15); do
  if curl -fsS "http://localhost:$PORT/" >/dev/null 2>&1; then
    ok "Deployed and healthy ($TARGET_BRANCH @ $(git -C "$MAIN_DIR" rev-parse --short HEAD))"
    exit 0
  fi
  sleep 1
done
die "Service did not become healthy on :$PORT — inspect 'journalctl -u $SERVICE -n 50'."
