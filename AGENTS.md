# Repository Guidelines

## Project Structure & Module Organization
This repository is organized as a small monorepo:
- `apps/web`: Next.js 15 + TypeScript frontend (`app/`, `components/`, `features/`, `lib/`, `scripts/`).
- `apps/api`: Express-based API (`src/routes`, `src/services`, `src/middleware`, `scripts/`).
- `tests`: manual/API testpack docs, REST client files, and run logs.
- `sql` and root `schema_v1.sql`: schema/seed resources for local DB setup.
- `docs`: product and flow documentation.

Keep feature logic close to each app; avoid cross-app imports except shared, stable assets.

## Build, Test, and Development Commands
Run commands from each app directory:

```powershell
cd apps/web; npm ci; npm run dev
cd apps/web; npm run web:check
cd apps/api; npm ci; npm start
cd apps/api; npm run test:e2e:health-smoke
```

- `npm run web:check` runs typecheck, i18n key checks, i18n snapshot test, and production build.
- API E2E scripts are available as `npm run test:e2e:*` (for example `test:e2e:settlement`).
- CI (`.github/workflows/ci-web-api.yml`) runs `web:check` and API health smoke on pull requests to `main`.

## Coding Style & Naming Conventions
- Use TypeScript for web and CommonJS JavaScript for API.
- Follow ESLint in `apps/web/eslint.config.mjs` (`next/core-web-vitals` + `next/typescript`).
- Use 2-space indentation and semicolons (match existing files).
- React component files: `PascalCase.tsx` (for example `DashboardTabs.tsx`).
- Utility/modules/functions: `camelCase` names; route files in API use resource-oriented names (for example `outboundOrders.js`).

## Testing Guidelines
- Web checks: `npm run typecheck`, `npm run i18n:check`, `npm run test:snapshot:detail-i18n`.
- Update i18n snapshot only for intentional text/locale changes:
  `npm run test:snapshot:detail-i18n:update`.
- API regression and flow checks live in `apps/api/scripts/*.ps1` and `*.js`.
- No formal coverage threshold is configured; at minimum, run impacted web checks and one relevant API E2E script before PR.

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat(web): ...`, `fix(api): ...`, `chore: ...`.
- Keep commits scoped and imperative (one concern per commit).
- PRs should include:
  - clear summary and affected paths (`apps/web`, `apps/api`, etc.),
  - linked issue/ticket (if available),
  - screenshots/GIFs for UI changes,
  - local commands run and results.
