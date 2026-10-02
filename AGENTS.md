# Base44 Dev Environment

## Stack
- **Frontend:** Vite 5 + React 18 + TypeScript + Tailwind v3 + React Router v6
- **Package manager:** Bun (bun.lock is the source of truth; package-lock.json also exists)
- **Backend:** Remote Supabase (Lovable Cloud). No local database — the app connects to a hosted Supabase project via credentials in the committed `.env` file.
- **Dev server:** `bun run dev` → Vite on port 8080 (mapped to host port 3000)

## Running the app
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
Verify: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → 200

## Key details
- The `.env` file (committed) contains real Supabase anon/publishable keys and PostHog keys. No external secrets need to be provided — the app boots with what's in the repo.
- `.env.development` contains the Paddle payments client token.
- `vite.config.ts` has `allowedHosts: true` added for the Base44 preview proxy.
- The `predev` script generates sitemaps before Vite starts; it runs automatically and takes <1s.
- **Hard rule:** Never introduce TanStack Start/Router into this repo (enforced by pre-commit hook, prebuild script, and CI).

## Architecture guardrails
Before shipping changes, run:
```bash
bun run check:no-tanstack && bun run lint && bunx vitest run src/test/architectureGuard.test.tsx
```
