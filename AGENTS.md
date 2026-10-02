# Base44 dev environment — Gradr

## Stack
Vite 5.4 + React 18 + TypeScript + Tailwind v3, managed with **bun**. Backend is
Lovable Cloud (Supabase) — no local DB or API process. The app is frontend-only;
Supabase publishable keys live in the repo's `.env` / `.env.development` and are
loaded by Vite automatically (no external secrets required to boot).

## Running
`docker compose -f docker-compose.base44.yml up -d` — builds the `oven/bun:1`
image, bind-mounts the source, runs `bun install --frozen-lockfile` then
`bun run dev` (which first regenerates `public/sitemap*.xml` via the `predev`
hook, then starts Vite on container port 8080 → host port 3000).

## The one gotcha: Vite 5.4 DNS-rebinding protection
Vite 5.4.19 backported `server.allowedHosts` (DNS-rebinding fix) but, unlike
Vite 6.1+, does **not** read the `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` env var
that the Base44 platform sets. Without wiring it in, the preview proxy's
external hostname (`<port>-<sandbox>.e2b.app`) gets a **403 "Blocked request"**
and the preview stays blank. `vite.config.ts` manually spreads that env var into
`server.allowedHosts` when present (no-op on Lovable / local dev where it's unset).

## Verifying
- `curl -H "Host: 3000-test.${BASE44_SANDBOX_HOST_DOMAIN}" http://localhost:3000/`
  must return **200** (not 403).
- `bun run typecheck` (uses `tsgo` / `@typescript/native-preview`) and
  `bun run build` both pass from the container.
- The landing page at `/` renders the Gradr hero with `.type-hero` resolving the
  `--text-h1*` CSS custom properties defined in `src/styles/design-system.css`.

## Architecture guardrails (from README)
Never introduce TanStack Start/Router — enforced by pre-commit hook, pre-build
script (`check:no-tanstack`), lint, and tests. Routing is `react-router-dom` v6.
