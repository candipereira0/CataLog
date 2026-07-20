#!/usr/bin/env bash
# Produce a Vercel Build Output API bundle (.vercel/output) for this site, then
# deploy it with:  bunx vercel deploy --prebuilt
#
# Vite SPA with Bun API backend. Vite outputs to dist/ (flat).
# The render function (vercel-entry.ts) handles /api/* routes and serves
# static files from .vercel/output/static/ with SPA fallback.
set -euo pipefail
cd "$(dirname "$0")"
umask 002
echo "[1/3] vite build (light — safe under the sandbox memory cap)"
bun install
bun run build
echo "[2/3] assemble .vercel/output (Build Output API v3)"
rm -rf .vercel/output
mkdir -p .vercel/output/static .vercel/output/functions/render.func
cp -R dist/* .vercel/output/static/
# Keep index.html — it's the SPA shell that the render function falls back to.
echo "[3/3] bundle SSR handler + deps into the render function"
bun build vercel-entry.ts --target node \
  --external bun:sqlite \
  --outfile .vercel/output/functions/render.func/index.mjs
cat > .vercel/output/functions/render.func/.vc-config.json <<'JSON'
{ "runtime": "nodejs22.x", "handler": "index.mjs", "launcherType": "Nodejs", "supportsResponseStreaming": true }
JSON
cat > .vercel/output/config.json <<'JSON'
{ "version": 3, "routes": [ { "src": "/assets/(.*)", "dest": "/assets/$1" }, { "handle": "filesystem" }, { "src": "/(.*)", "dest": "/render" } ] }
JSON
echo "done -> .vercel/output ready for: bunx vercel deploy --prebuilt"
