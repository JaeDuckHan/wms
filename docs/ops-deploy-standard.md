# WMS Runtime and Deployment Standard

This document is the single source of truth for production runtime/deploy policy.

## 1) Runtime path (single source)
- Monorepo root: `/var/www/wms`
- Web runtime cwd: `/var/www/wms/apps/web`
- API runtime cwd: `/var/www/wms/apps/api`
- Legacy split paths (`/var/www/3pl`, `/var/www/wms-api`) are not allowed.

## 2) PM2 standard execution
- PM2 app name: `3pl-web`
- Required command: `npm run start -- -p 3000`
- Forbidden in app args: `--time`, `--max-memory-restart`, and other non-app flags
- Keep process config in `apps/web/ecosystem.config.cjs`

## 3) Prevent `next: not found` after deploy
- Always run `npm ci` at `apps/web` during deploy.
- Then run `npm run build`.
- Do not reuse stale `node_modules` between releases.

## 4) i18n location contract
- Official path: `apps/web/lib/i18n/*`
- Root path `lib/i18n/*` is deprecated and removed.
- CI must fail if `root/lib/i18n` is reintroduced.

## 5) Dashboard proxy/backend route contract
- Backend route prefix: `/api/dashboard/*` only.
- Frontend proxy route: `apps/web/app/api/dashboard/[...path]/route.ts`
- Fallback contract to `/dashboard/*` is not supported.

## 6) CI gates (required before merge to `main`)
- Web: `npm ci && npm run web:check`
- API: `npm ci && npm run build`
- Web smoke: `GET /login` must return `200` after `npm run start -- -p 3000`
- API smoke: `GET /health` must return `200` (`npm run test:e2e:health-smoke`)
