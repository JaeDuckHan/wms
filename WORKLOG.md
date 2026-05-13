## 2026-05-13 (Internal inventory flow test readiness)

- [Request] Defer Shopee API work until the internal WMS flow is testable end to end.
- [Web] Added missing inbound/outbound creation entry points and flow support.
  - `/inbounds/new`
  - `/outbounds/new`
  - list-page `New` buttons remain write-role gated.
- [Web] Added warehouse location selection to inbound/outbound item creation.
  - New API proxy allowlist entry: `warehouse-locations`
  - New web helper: `apps/web/features/operations/warehouseLocationsApi.ts`
  - If active locations exist for the selected warehouse, testers can select by location code instead of typing numeric Location ID.
- [API] Added warehouse location lookup route.
  - `GET /warehouse-locations`
  - Supports `warehouse_id` and `status` filters.
- [API/Test data] Added repeatable internal flow seed.
  - Script: `npm run seed:flow-test`
  - Creates/reactivates active client, warehouse, location, admin login, product, lot, and stock balance.
  - Default login: `flow.admin@example.com` / `flow1234`
- [API/E2E] Added inventory flow regression script.
  - Script: `npm run test:e2e:inventory-flow`
  - Verifies inbound `received`, outbound `allocated`, outbound `shipped`, and `INSUFFICIENT_STOCK` behavior.
- [Docs] Added flow-test seed guide: `apps/api/sql/seed/README_flow_test_data.md`.
- [Verification]
  - `node --check src/routes/warehouseLocations.js` passed.
  - `node --check scripts/seed_flow_test_data.js` passed.
  - `node --check scripts/e2e_inventory_flow.js` passed.
  - `apps/api`: `npm run build` passed.
  - `apps/web`: `npm run web:check` passed after stopping the prior 3001 dev server that locked `.next/trace`.
  - `http://127.0.0.1:3001/inbounds/new` returned 200 OK.
  - `http://127.0.0.1:3001/outbounds/new` returned 200 OK.
- [Runtime blocker]
  - `npm run seed:flow-test` could not run against local DB because MySQL was not listening on `127.0.0.1:3306`.
  - Docker Desktop daemon was also not running, so DB-backed E2E remains pending until MySQL/Docker is started.
## 2026-02-26

- [Request] Confirmed where the top navigation "User Guide" item is defined in the web code.
- [Code search] Found top button in `apps/web/components/layout/Topbar.tsx`.
- [Code search] Found guide page in `apps/web/app/(console)/guide/page.tsx`.
- [Fix] Corrected broken Topbar button label to bilingual guide text.
- [Verification] Shared first 20 lines of guide page as requested.
- [Requirement check] Confirmed guide page content was mostly English and not i18n-driven.
- [Implementation] Translated the full `/guide` page content to Korean.
  - Updated breadcrumbs, title, subtitle, section titles, and full checklist text.
- [Git] Committed and pushed the change.
  - Commit: `cbd0dd3`
  - Message: `feat(web): translate guide page content to Korean`
  - Branch: `main`
  - Remote: `origin/main`
- [Note] `Topbar.tsx` had no final content diff at commit time, so only guide page was included in commit.

### Files touched

- `apps/web/components/layout/Topbar.tsx`
- `apps/web/app/(console)/guide/page.tsx`

### Commands used

- `rg` for text/path search
- `Get-Content` for line-level inspection
- `git status`, `git diff`, `git commit`, `git push`

## 2026-03-01

- [Request] Requested Phase1 execution summary, modified-file report, and worklog update.
- [Phase1 status] Team run (`execute-plan-omx-plans-phase1`) completed as bootstrap/triage only.
- [Blocker] Referenced plan path mismatch: expected `.omx/plans/phase1-inbound-inventory-log-hardening.md` under `/home/kowinsblue`, but actual project plan exists in `/mnt/d/_ì‘ì—…í´ë”_codex/.omx/plans/phase1-inbound-outbound-inventory-log-hardening.md`.
- [Blocker] Worker runtime cwd had no target `package.json`, so typecheck/test/lint/e2e commands were not executable.
- [Result] No confirmed Phase1 source-code implementation in `apps/api` / `apps/web` from that team run.

### ë‚¨ì€ ì¼ (Next)

1. ì‹¤í–‰ ê¸°ì¤€ ê²½ë¡œ ê³ ì •
   - Team/worker ì‹¤í–‰ cwdë¥¼ `/mnt/d/_ì‘ì—…í´ë”_codex`ë¡œ ê³ ì •.
2. ê³„íš íŒŒì¼ ê²½ë¡œ ì •í•©í™”
   - ì‹¤í–‰ promptì™€ ì‹¤ì œ plan íŒŒì¼ëª…/ê²½ë¡œë¥¼ ì¼ì¹˜ì‹œì¼œ ì¬ì‹¤í–‰.
3. Phase1 ë³¸ì‘ì—… ìˆ˜í–‰ (ê³„íšì„œ Step 1~5)
   - ê¸°ì¤€ì‹/ì´ë²¤íŠ¸ ë™ê²° â†’ DB ì´ˆê¸°í™”/ìƒ˜í”Œ ì¬ì ì¬ baseline â†’ API ë¡œê·¸ ì ì¬ ë³´ê°• â†’ UI/API ì •í•©ì„± ë§ì¶¤ â†’ íšŒê·€ ê²€ì¦ ë¦¬í¬íŠ¸.
4. ê²€ì¦ ê²Œì´íŠ¸ ê°•ì œ
   - `NEXT_PUBLIC_USE_MOCK=false` ê¸°ì¤€ìœ¼ë¡œ API/SQL/UI êµì°¨ ê²€ì¦.
5. 2ì°¨ ë²”ìœ„ ë¶„ë¦¬ ìœ ì§€
   - tenant/client_id ê°•ì œ ì ‘ê·¼ì œì–´ëŠ” Phase2ë¡œ ìœ ì§€.

### Reference

- Plan: `.omx/plans/phase1-inbound-outbound-inventory-log-hardening.md`
- Open questions: `.omx/plans/open-questions.md`

### ì¶”ê°€ ì§„í–‰ (WSL MySQL / ìš´ì˜ìœ ì‚¬ ìƒ˜í”Œë°ì´í„° ì ì¬)

- [Env] ì‹¤í–‰ í™˜ê²½ì„ Windows PowerShell ê¸°ì¤€ì—ì„œ **WSL(Ubuntu 24.04 / WSL2)** ê¸°ì¤€ìœ¼ë¡œ ì¬ì •ë ¬.
- [DB check] WSL ë‚´ë¶€ì—ì„œ MySQL ìƒíƒœ í™•ì¸:
  - `mysqld` í”„ë¡œì„¸ìŠ¤ ì‹¤í–‰ í™•ì¸
  - `127.0.0.1:3306`, `127.0.0.1:33060` LISTEN í™•ì¸
- [Issue] `npm run seed:phase1-integrated` ìµœì´ˆ ì‹¤í–‰ ì‹œ `Access denied for user 'root'@'localhost'` ë°œìƒ.
- [Action] `.env` DB ê³„ì • ì‚¬ìš© ê°€ì´ë“œ ì œê³µ(`root` â†’ `wms`) ë° ê¶Œí•œ ì‚¬ìš©ì ìƒì„± ì ˆì°¨ ì•ˆë‚´.
- [Issue] ì´í›„ `Table 'wms_test.clients' doesn't exist` ë°œìƒ.
- [Action] `schema_v1.sql`ë¥¼ `wms_test`ì— ì¬ì ì¬í•˜ë„ë¡ ì•ˆë‚´ í›„ í…Œì´ë¸” ìƒì„± í™•ì¸.
- [Result] `npm run seed:phase1-integrated` ì‹¤í–‰ ì™„ë£Œ.
- [Validation] `apps/api/sql/seed/seed_phase1_05_validation.sql` ê²€ì¦ ê¸°ì¤€ PASS í™•ì¸(ì‚¬ìš©ì ë³´ê³ ).
- [Runtime check] API ê¸°ë™ í›„ `/health`, `/health/db` ì •ìƒ ì‘ë‹µ(ì‚¬ìš©ì ë³´ê³ ).
- [Git] ë³€ê²½ì‚¬í•­ ì»¤ë°‹ ì™„ë£Œ:
  - Commit: `296c890`
  - Message: `feat(web-api): apply phase1 integrated flow and UI/API updates`
  - Scope: 139 files staged/committed (seed ìŠ¤í¬ë¦½íŠ¸ í¬í•¨)
- [Git push blocker] í˜„ì¬ ì„¸ì…˜ì—ì„œëŠ” GitHub HTTPS ì¸ì¦ ë¶€ì¬ë¡œ push ì‹¤íŒ¨(`could not read Username`).
- [Next] ì‚¬ìš©ì ë¡œì»¬ í„°ë¯¸ë„(WSL ë˜ëŠ” Windows PowerShell)ì—ì„œ ì¸ì¦ í›„ `git push origin main` ì§„í–‰ í•„ìš”.

## 2026-03-01 (Billing/Inventory updates)

- [Request] Applied inventory/billing behavior updates and wording changes from latest discussion.
- [API] Inbound stock application is now state-driven (`received` only).
  - Inbound item create/update/delete now apply stock txn only when order status is `received`.
  - Inbound order status transition now applies/rolls back stock effects on enter/exit of `received`.
- [API] Settlement event timing/status rules tightened.
  - Outbound billing events are active only for `shipped`/`delivered`.
  - Inbound billing events are active only for `received`.
  - Event date now uses `shipped_at` (outbound) / `received_at` (inbound) when present.
- [UI] Billing screens terminology updated.
  - Changed action text from `Filter` to `Search` on billing list pages.
- [Transparency] Added original THB visibility alongside KRW in invoice list/detail.
  - API returns `subtotal_thb` computed from linked `billing_events`.
  - Web invoice list/detail now show `Original THB`.
- [Sample seed] Improved sample billing events generation UX/reliability.
  - Avoids static reference IDs by using unique suffix.
  - Handles warehouse-required schemas more robustly.
  - UI toast now reports inserted count and where to verify.
- [Verification]
  - `node --check apps/api/src/routes/billingEngine.js` passed.
  - `node --check` passed for modified API route/service files.
  - `cd apps/web && npm run typecheck` passed.

## 2026-03-01 (Billing UX hardening + CI follow-up)

- [CI fix] Resolved `web:check` i18n token failure (`Search`) on billing pages.
  - Updated billing list buttons to avoid unknown i18n token path in `i18n:check`.
- [Billing transparency] Added THB-origin amount exposure in invoice list/detail.
  - API includes `subtotal_thb` from linked `billing_events`.
  - Web shows `Original THB` next to KRW amounts.
- [Sample event reliability] Hardened sample seed behavior in API.
  - Uses unique `SAMPLE-*` reference IDs to avoid collisions.
  - Handles warehouse-required schema cases more safely.
  - Returns inserted count for UI feedback.
- [Sample cleanup] Added sample cleanup API and UI action.
  - Endpoint: `POST /billing/events/sample/cleanup`
  - Scope: `client_id + invoice_month`, `reference_id LIKE 'SAMPLE-%'`, `invoice_id IS NULL` only.
- [Confirmation UX] Added confirmation dialogs across similar billing actions.
  - Sample generation, draft regeneration, sample cleanup now require confirm.
  - Invoice row actions `Issue` and `Mark Paid` now require confirm.
  - Dialog copy includes client/month context and target count where applicable.
- [Verification]
  - `apps/web`: `npm run typecheck` passed.
  - `apps/web`: `npm run i18n:check` passed.
  - API changed routes passed `node --check`.

### Commits

- `f2f41da` feat(api-web): align settlement transparency and status-based stock/billing logic
- `785461c` fix(web): avoid missing i18n token for billing search button
- `bc95563` feat(billing): add sample cleanup flow and confirmation dialogs

## 2026-03-01 (Billing range search + guide sync)

- [Request] Updated billing invoice search to year + MM-DD range style.
- [Web] Replaced month/date-centric search inputs with:
  - `Year (YYYY)`
  - `From MM-DD`
  - `To MM-DD`
- [Behavior] Search now queries invoice date range (`invoice_date_from` ~ `invoice_date_to`).
- [Behavior] Invoice generate/re-generate now derives:
  - `invoice_date` from end date (`To`)
  - `invoice_month` from end date month
- [Validation] Added range guard (`from > to` invalid) and user-facing message.
- [API] `/billing/invoices` now accepts and applies `invoice_date_from`, `invoice_date_to` filters.
- [Guide] Updated guide page to include latest billing admin operations and confirmation-flow notes.
- [Verification]
  - `apps/web`: `npm run typecheck` passed.
  - `apps/web`: `npm run i18n:check` passed.
  - API route syntax check passed.

### Commit

- `c093316` feat(billing): support year+day-range search and update admin guide

## 2026-03-01 (Billing UX flow polish: calendar/search/navigation)

- [Request] Fixed billing UX flow issues found during live verification.
- [Web] Billing invoice search input switched to calendar date pickers.
  - Replaced `Year + MM-DD` text inputs with `type="date"` range inputs.
  - Search continues to use `invoice_date_from` / `invoice_date_to`.
  - Invoice generate baseline remains end-date based (`invoice_date`, `invoice_month`).
- [Web] Button interaction affordance improved.
  - Added pointer cursor for enabled buttons.
  - Added not-allowed cursor for disabled buttons.
- [Web] Billing tab order aligned to operation flow.
  - `Billing Events` now shown before `Invoices`.
- [Web] Sidebar billing entry now opens billing events first.
  - Changed sidebar Billing route from `/billing` to `/billing/events`.
  - Kept Billing active state for all `/billing*` pages including invoice detail.
- [Verification]
  - `apps/web`: `npm run typecheck` passed after each UX patch.

### Commits

- `534a231` feat(web): switch billing invoice date filters to calendar pickers
- `75d3957` fix(web): show pointer cursor on interactive buttons
- `a0830f8` fix(web): reorder billing tabs to events before invoices
- `9ea6283` fix(web): route billing nav entry to billing events by default
- `9db065e` feat(api): apply outbound shipment status-driven stock and billing sync

## 2026-03-02 (Docker deployment baseline + realistic sample data)

- [Request] Switched deployment guidance to Docker-based operations for Ubuntu server (`3pl.kowinsblue.com`).
- [DevOps] Added monorepo-level Docker Compose stack and app Dockerfiles.
  - `web` (Next.js), `api` (Express), `db` (MySQL 8) as a single `docker compose` runtime.
  - Host exposure policy: bind app ports to `127.0.0.1` and keep public access through host Nginx only.
- [DevOps] Added deployment/env documentation for Docker flow.
  - Introduced `docker.env.example` and `apps/web/DOCKER_DEPLOYMENT.md`.
- [Data] Added new realistic sample seed for integrated operations.
  - File: `apps/api/sql/seed/seed_sample_realistic_10x.sql`
  - Includes minimum 10 records each for inbound/outbound/stock balance-linked flows.
  - Updated to cosmetics-domain sample products and realistic order/tracking style IDs.
- [UI/API alignment] Updated inbound client label rendering to include code + name.
  - Inbound list/detail client text now uses `client_code | client_name`.
- [Compatibility fix] Applied MySQL 8 collation compatibility in sample seed.
  - `SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci`
  - Temporary table collation explicitly set to `utf8mb4_0900_ai_ci`.
- [Ops note] Existing DB volumes do not auto-rerun init scripts; sample seed can be applied manually via `cat ... | mysql` pipeline.

### Commits

- `9589c19` feat(devops): add docker compose deployment stack
- `607fa19` feat(api): add realistic 10x sample seed for inbound outbound stock
- `ba1e42e` chore(api): refine sample seed to realistic cosmetics data
- `1d819f5` fix(api): align sample seed collation for mysql8 compatibility
- `38eb0b6` feat(web): show inbound client code with realistic cosmetics sample clients

## 2026-03-02 (Docker runtime validation + billing schema alignment)

- [Server feedback] Docker runtime on Ubuntu validated with HTTPS/Nginx already active, but app-side compose/table mismatch discovered during live bring-up.
- [Issue] API container did not include `/app/scripts`, so scenario seed script required manual copy inside container.
- [Issue] DB had `service_events` but lacked `billing_events`, while Billing Events UI/API (`/billing/events`) depends on `billing_events`.
- [Impact] Billing Events tab remained empty even when inbound/outbound records existed in non-billable/billable statuses.
- [Fix] Updated Docker/API packaging and DB init order to align billing schema automatically on fresh bootstrap.
  - `apps/api/Dockerfile`: include `scripts/`, `sql/`, `.env.example`.
  - `docker-compose.yml`: add init patches before sample seed:
    1) `patch_billing_invoice_engine.sql`
    2) `patch_multi_warehouse_billing_storage.sql`
- [Fix] Updated runbook to include patch commands for already-running DB volumes.
  - `apps/web/DOCKER_DEPLOYMENT.md` now includes explicit patch execution commands.
- [Fix] Hardened integrated scenario seed script behavior when billing schema is absent.
  - Added warning path: skip billing seed with clear log if `billing_events` table is missing.
- [Ops confirmation] After patching, expected table ownership is:
  - Billing tab/event engine: `billing_events`
  - Legacy settlement flow linkage: `service_events`

### Commits

- `8636d15` feat(api): add integrated random scenario seed for end-to-end testing
- `6ff37ef` fix(devops): include api scripts and billing schema patches in docker flow

## 2026-03-02 (Billing contract hardening + health/openapi sync + i18n recovery)

- [Request] `docs/worklog-based-feature-uiux-proposals-2026-03-02.md` ±âÁØÀ¸·Î ¿ì¼±¼øÀ§ ÀÛ¾÷(P0 -> P1 -> OpenAPI sync)À» ¼øÂ÷ Àû¿ë.
- [P0 API guard] Billing ÇÊ¼ö ½ºÅ°¸¶ readiness Á¡°Ë Ãß°¡.
  - `apps/api/src/db.js`: Billing required tables + readiness À¯Æ¿ Ãß°¡.
  - `apps/api/src/server.js`: `/health/db`¿¡ `billing.ready`, `missing_tables`, `table_presence` Æ÷ÇÔ.
  - Billing schema ¹ÌÁØºñ ½Ã `/health/db`´Â `503`À¸·Î ¸í½ÃÀû ½ÇÆĞ ¹İÈ¯.
- [P0 startup safety] API ±âµ¿ ½Ã ½ºÅ°¸¶ °¡µå ·Î±× Ãß°¡.
  - dev ±âº» `warn`, production ±âº» `strict`.
  - `BILLING_SCHEMA_GUARD_MODE`·Î ¿À¹ö¶óÀÌµå °¡´É.
- [P0 Docker ops] ±âÁ¸ volume È¯°æ¿ë idempotent billing patch ½ºÅ©¸³Æ® Ãß°¡.
  - `apps/api/scripts/run_docker_billing_patch_idempotent.sh`
  - `apps/web/DOCKER_DEPLOYMENT.md`¿¡ ½ºÅ©¸³Æ® ±â¹İ ÀıÂ÷ ¹İ¿µ.
- [P1 UX contract] Billing invoice ±â°£ °ËÁõ ¸Ş½ÃÁö Å¬¶óÀÌ¾ğÆ®/¼­¹ö ÅëÀÏ.
  - °øÅë ¸Ş½ÃÁö:
    - `Please select both start and end dates.`
    - `Start date cannot be later than end date.`
  - API `/billing/invoices`¿¡¼­ Àß¸øµÈ range ¿äÃ»À» `400 INVALID_DATE_RANGE`·Î Ã³¸®.
  - Web ÀÎº¸ÀÌ½º ÆäÀÌÁöÀÇ ÇÏµåÄÚµù ¹®±¸¸¦ i18n Å° ±â¹İÀ¸·Î Á¤¸®.
- [P1 i18n governance] `Search`, `Issue`, `Mark Paid`, `Original THB` ÅäÅ«À» i18n »çÀü¿¡ µî·ÏÇØ Ã¼Å© ¾ÈÁ¤È­.
- [i18n recovery] `messages.ko.ts`°¡ ÆÄ¼­ ¿¡·¯ »óÅÂ¿´´ø ¹®Á¦¸¦ UTF-8 Á¤»ó ±¸Á¶ + ÇÑ±¹¾î °ªÀ¸·Î º¹±¸.
  - ¸Ş´º/È­¸é º´±â(`ÇÑ±Û / English`) Ç¥½Ã µ¿ÀÛ º¹¿ø.
- [P0 docs sync] `/health/db` ½ÇÁ¦ ÀÀ´ä(200/503/500) ½ºÆåÀ» `apps/api/src/openapi.json`¿¡ µ¿±âÈ­.

### Verification

- `apps/api`: `node --check` (¼öÁ¤ ¶ó¿ìÆ®/¼­¹ö/db) passed.
- `apps/api`: `npm run build` passed.
- `apps/api`: `npm run test:e2e:health-smoke` passed (`/health` ±âÁØ).
- `apps/web`: `npm run i18n:check` passed.
- `apps/web`: `npm run typecheck` passed.

## 2026-03-03 (Billing events year/month filter UX + guide expansion)

- [Request] Billing ÀÌº¥Æ® Á¶È¸¸¦ `³âµµ + ¿ù` ¼±ÅÃ ¹æ½ÄÀ¸·Î º¯°æ.
- [Web] Billing Events ÇÊÅÍ¸¦ `type=month` ´ÜÀÏ ÀÔ·Â¿¡¼­ `Year(YYYY) + Month(¼±ÅÃ)`À¸·Î °³Æí.
  - ±âº» Á¶È¸: `ÇØ´ç³âµµ + ´ç¿ù`
  - `³âµµ + ¿ù` ¼±ÅÃ: ÇØ´ç ¿ù Á¶È¸
  - `³âµµ¸¸ + ¿ù ºñ¿ò`: ÇØ´ç³âµµ ÀüÃ¼ Á¶È¸
- [API] `/billing/events` ¹× CSV export°¡ `invoice_year` Äõ¸®¸¦ Áö¿øÇÏµµ·Ï È®Àå.
  - `invoice_month` ¿ì¼± Àû¿ë
  - `invoice_month` ¹ÌÁöÁ¤ ½Ã `invoice_year` Àû¿ë
- [Web API layer] `listBillingEvents`, `billingEventsCsvUrl`¿¡ `invoice_year` ÆÄ¶ó¹ÌÅÍ ¿¬µ¿.
- [Guide] »ç¿ëÀÚ °¡ÀÌµå¸¦ ÃÊº¸ÀÚ ±âÁØÀ¸·Î »ó¼¼ È®Àå.
  - ¸Ş´ºº° ÇÙ½É ±â´É ¼³¸í
  - Billing Events / Invoices ½Ç»ç¿ë ÀıÂ÷
  - 0°Ç Á¶È¸ ½Ã Á¡°Ë ¼ø¼­
- [Performance rationale] ÀüÃ¼ ±â°£ ±âº»Á¶È¸´Â DB ºÎÇÏ ¿ì·Á°¡ ÀÖ¾î Ã¤ÅÃÇÏÁö ¾Ê°í, ±âº»À» ´ç¿ù·Î À¯Áö.

### Verification

- `apps/api`: `node --check apps/api/src/routes/billingEngine.js` passed.
- `apps/web`: `npm run typecheck` passed.
- `apps/web`: `npm run i18n:check` passed.

## 2026-03-05 (Push recovery + Product modal/DB compatibility follow-up)

- [Network] WSL ì„¸ì…˜ì—ì„œ `github.com` DNS í•´ì„ ì‹¤íŒ¨(`Could not resolve host`) ì¬í˜„ í™•ì¸.
- [Push retry] ë„¤íŠ¸ì›Œí¬ ê¶Œí•œ ì´ìŠˆ ë¶„ë¦¬ í™•ì¸ í›„ í‘¸ì‹œ ì¬ì‹œë„ ì„±ê³µ:
  - `wms-web`: `main -> main` (`3d1e8f6`)
  - `wms-api`: `backup/pre-monorepo` ì‹ ê·œ ë¸Œëœì¹˜ í‘¸ì‹œ (`790d4bb`)
- [Repo alignment] ì‹¤ì‚¬ìš© ì €ì¥ì†Œë¥¼ monorepo `wms`ë¡œ ì¬í™•ì¸í•˜ê³  `origin/main` ë™ê¸°í™” ìƒíƒœ ì ê²€.
- [Fix/web] ìƒí’ˆ ë“±ë¡ ëª¨ë‹¬ì—ì„œ CBM í•„ë“œ ê°€ì‹œì„± ê°œì„ .
  - ëª¨ë‹¬ ìŠ¤í¬ë¡¤ ê°€ëŠ¥í•˜ë„ë¡ ì¡°ì •(`max-h` + `overflow-y-auto`)
  - `CBM (mÂ³)` ì…ë ¥ ë…¸ì¶œ ìˆœì„œ ìƒí–¥
- [Fix/web] ìƒí’ˆ ë“±ë¡ ëª¨ë‹¬ ì¹˜ìˆ˜ ì…ë ¥ UX ê°œì„ .
  - `Width/Length/Height`ë¥¼ ë‹¨ì¼ ë¼ì¸(`W/L/H`) ì…ë ¥ìœ¼ë¡œ ë³€ê²½.
- [Fix/api] êµ¬ë²„ì „ DB ìŠ¤í‚¤ë§ˆ í˜¸í™˜ ì²˜ë¦¬.
  - `products` í…Œì´ë¸”ì˜ ì„ íƒ ì»¬ëŸ¼(`width_cm`, `length_cm`, `height_cm`, `cbm_m3`, `min_storage_fee_month`) ì¡´ì¬ ì—¬ë¶€ë¥¼ ì¡°íšŒí•´ ë™ì  SELECT/INSERT/UPDATE ì ìš©.
  - ì—ëŸ¬ `Unknown column 'p.width_cm' in 'field list'` íšŒí”¼.
- [DB check] í˜„ì¬ í™•ì¸ í™˜ê²½ì˜ `wms_test.products`ì—ì„œ ì¹˜ìˆ˜/CBM ì»¬ëŸ¼ ì¡´ì¬ í™•ì¸.
  - `width_cm`, `length_cm`, `height_cm`, `cbm_m3`, `min_storage_fee_month`

### Commits

- `ad27d5d` fix(web): ensure cbm field is visible in product modal
- `e786a14` fix(api-web): support legacy product schema and compact dimension inputs

### Verification

- `apps/web`: `npm run typecheck` passed.
- `apps/api`: `node --check src/routes/products.js` passed.

## 2026-03-05 (Remote safety hardening)

- [Request] ì˜ëª»ëœ ì €ì¥ì†Œ í‘¸ì‹œ ì¬ë°œ ë°©ì§€ë¥¼ ìœ„í•´ ë¶„ë¦¬ ì €ì¥ì†Œ remote ë¹„í™œì„±í™” ìš”ì²­.
- [Action] ë‹¤ìŒ ì €ì¥ì†Œì—ì„œ `origin` remoteë¥¼ `origin-disabled`ë¡œ ë³€ê²½.
  - `/mnt/d/_ì‘ì—…í´ë”_codex/wms-web`
  - `/mnt/d/_ì‘ì—…í´ë”_codex/wms-api`
- [Result] ì‹¤ì‚¬ìš© monorepo(`/mnt/d/_ì‘ì—…í´ë”_codex`)ì˜ `origin = https://github.com/JaeDuckHan/wms.git`ëŠ” ìœ ì§€.
- [Current remotes]
  - `wms-web`: `origin-disabled(3pl.git)`, `wms(wms.git)`
  - `wms-api`: `origin-disabled(wms-api.git)`


## 2026-03-05 (Working folder definition to avoid confusion)

- [Rule] Before starting work, record the exact target repository/folder first.
- [Primary monorepo root]
  - `D:\_ÀÛ¾÷Æú´õ_codex`
  - Targets: `apps/web`, `apps/api`, `sql`, `docs`, `tests`
  - Remote: `origin = https://github.com/JaeDuckHan/wms.git`
- [Legacy split repos under same workspace]
  - `D:\_ÀÛ¾÷Æú´õ_codex\wms-web` (web repo)
  - `D:\_ÀÛ¾÷Æú´õ_codex\wms-api` (api repo)
- [Execution policy]
  - If user does not specify, default working folder is `D:\_ÀÛ¾÷Æú´õ_codex`.
  - If runtime is from `wms-web` / `wms-api`, verify and apply same fixes there as needed.
  - Before commit/push, always re-check target repo with `git -C <repo> status -sb`.
- [Incident note]
  - Warehouse edit error (`Invalid request body`) happened because runtime path was `wms-web/wms-api`, not `apps/*` monorepo path.
  - From now on, each worklog entry will include both `working folder` and `runtime folder`.

## 2026-03-05 (CBM display trim + Phase2 SKU billing preview)

- [Working folder] `D:\_ÀÛ¾÷Æú´õ_codex\wms-web`, `D:\_ÀÛ¾÷Æú´õ_codex\wms-api`
- [Runtime folder] `wms-web/apps/web`, `wms-api/src`
- [Request] In Settings > Products, trim CBM display from `0.008000` to `0.008`; then continue phase2 work.
- [Web/Product] Updated CBM display formatting to 3-decimal rounded compact output (trailing zeros removed).
  - Affected: product list CBM column and auto preview text in product modal.
- [API/Phase2] Added SKU-level CBM billing preview endpoint.
  - New route: `GET /api/dashboard/storage/billing/sku-preview`
  - Inputs: `month`, `warehouseId`, `clientId`, optional `rateCbm`
  - Behavior: calculates per-SKU amount using `available_qty * cbm_m3 * rate_cbm`
  - Rate source: query `rateCbm` override -> otherwise warehouse `default_cbm_rate` fallback (if column exists).
- [API/Billing preview] Updated existing monthly billing preview to apply warehouse `default_cbm_rate` when `rateCbm` query override is omitted.
- [Web/Dashboard] Added SKU CBM Billing Preview section in Storage Billing page when warehouse/client filters are set.
  - Shows per-SKU rows: product, qty, cbm_m3, rate_cbm, amount_cbm.
- [Stability] Resolved leftover merge-conflict markers in `Sidebar.tsx` and `PageHeader.tsx` that were blocking web build.
- [Verification]
  - `wms-api`: `node --check src/routes/dashboard.js` passed.
  - `wms-web`: `npm run build` passed.

## 2026-03-05 (User confirmation note: SKU CBM preview page)

- [Working folder] `D:\_ÀÛ¾÷Æú´õ_codex\wms-web`, `D:\_ÀÛ¾÷Æú´õ_codex\wms-api`
- [Runtime folder] `wms-web/apps/web`, `wms-api/src`
- [Preview screen path] `/dashboard/storage-billing`
- [How to view billing basis]
  - Set `warehouseId` and `clientId` in filter.
  - Check `SKU CBM Billing Preview` section for per-SKU rows.
  - Monthly client total basis is `summary.total_amount_cbm` (sum of SKU `amount_cbm`).
- [Note] Current implementation is preview/billing-basis, not invoice issuance.

## 2026-03-05 (Storage billing readability improvements)

- [Working folder] `D:\_ÀÛ¾÷Æú´õ_codex\wms-web`, `D:\_ÀÛ¾÷Æú´õ_codex\wms-api`
- [Runtime folder] `wms-web/apps/web`, `wms-api/src`
- [Request] In storage billing page, IDs-only view is hard to understand.
- [API] Added human-readable fields to billing preview response:
  - `warehouse_name`, `client_name`, `sku_count` in monthly lines
  - `warehouse_name`, `client_name`, `total_sku_count` in SKU preview summary
- [Web] Updated storage billing UI:
  - Warehouse/Client columns now show `name + ID`
  - Added `sku_count` column
  - Search supports name matching
  - SKU preview summary shows warehouse/client names and total SKU count
- [Verification]
  - `wms-api`: `node --check src/routes/dashboard.js` passed.
  - `wms-web`: `npm run build` passed.

## 2026-03-05 (Storage billing filter hint duplicate fix)

- [Working folder] `D:\_ÀÛ¾÷Æú´õ_codex`, `D:\_ÀÛ¾÷Æú´õ_codex\wms-web`
- [Runtime folder] `apps/web`, `wms-web/apps/web`
- [Request] Storage billing filter area showed duplicate helper text under Load button.
- [Fix/web] Removed duplicated `filter.pressEnter` render line in `FilterBar` for both runtime paths.
  - `apps/web/components/dashboard/FilterBar.tsx`
  - `wms-web/apps/web/components/dashboard/FilterBar.tsx`
- [Note] If warehouse/client still appear as numeric-only, check which API/runtime path is actually running (`apps/*` monorepo vs `wms-web/wms-api`) and align deployment target.
- [API sync/monorepo] `apps/api/src/routes/dashboard.js` billing preview now includes `warehouse_name`, `client_name`, `sku_count` so Storage Billing table can render name+ID instead of numeric-only in monorepo runtime too.

## 2026-03-05 (Storage billing readability + duplicate hint hotfix, final)

- [Working folder] `D:\_ÀÛ¾÷Æú´õ_codex`
- [Runtime folder] `apps/web`, `apps/api`
- [Issue] Storage billing filter helper text (`filter.pressEnter`) rendered twice under Load/Á¶È¸ button.
- [Fix/web] Removed duplicated helper line in dashboard `FilterBar`.
  - `apps/web/components/dashboard/FilterBar.tsx`
- [Issue] In some runtime paths, billing lines showed ID-only values (`warehouse_id`, `client_id`) without names.
- [Fix/api] Extended monorepo billing preview response to include human-readable fields:
  - `warehouse_name`, `client_name`, `sku_count`
  - file: `apps/api/src/routes/dashboard.js`
- [Verification]
  - `apps/web`: `npx --no-install tsc --noEmit --pretty false --incremental false` passed
  - `apps/api`: `node --check src/routes/dashboard.js` passed
- [Hotfix/web] Storage billing page now resolves warehouse/client names from Settings master lists when API line payload has ID only.
  - file: `apps/web/features/dashboard/StorageBillingPage.tsx`
  - effect: even if `warehouse_name/client_name` is missing, UI shows `Warehouse #id` / `Client #id` fallback and master-name mapping when available.
- [UX/web] Storage billing page hides developer-oriented warning card/column for simpler non-technical view.
  - file: `apps/web/features/dashboard/StorageBillingPage.tsx`
  - retained: core amount columns and summary cards.

## 2026-03-05 (Storage billing real-data verification + fallback hardening)

- [Working folder] `D:\_ÀÛ¾÷Æú´õ_codex`
- [Runtime folder] `apps/api`, `apps/web`
- [Finding] `sku_count=0` and uniform `rate_cbm=1200` pattern was caused by dashboard fallback response, not real billing computation.
- [Root causes found during real run]
  - API DB credential mismatch (`wms` denied) in local `.env` runtime.
  - Missing table `storage_snapshots`.
  - Missing product CBM columns (`cbm_m3`, `min_storage_fee_month`) before patch.
- [DB actions for verification]
  - Applied `apps/api/sql/patch_multi_warehouse_billing_storage.sql`.
  - Applied `apps/api/sql/patch_storage_billing_cbm.sql`.
  - Generated snapshot via `POST /api/dashboard/storage/snapshots/generate`.
  - Inserted active storage rate (`warehouse_id=203`, `client_id=104`, `rate_cbm=5000`, `effective_from=2026-03-01`).
- [Real API verification result]
  - `/api/dashboard/storage/billing/preview?month=2026-03` returned
    - `sku_count: 1`
    - `avg_cbm: 0.012`
    - `rate_cbm: 5000`
    - `amount_total: 60`
- [Fix/web] Hardened dashboard fallback switch.
  - `apps/web/features/dashboard/api.ts`
  - changed default from fallback ON to fallback OFF unless `NEXT_PUBLIC_DASHBOARD_FALLBACK=true` is explicitly set.
- [Hotfix/web] Disabled dashboard fallback unconditionally for storage pages to prevent silent fake billing values (`sku_count=0`, `rate_cbm=1200`) on API failure.
  - file: `apps/web/features/dashboard/api.ts`
  - policy: show real API error instead of synthetic fallback rows.
- [API compatibility] Hardened dashboard storage billing/snapshot logic for legacy product schemas without `cbm_m3`.
  - file: `apps/api/src/routes/dashboard.js`
  - added dynamic column checks via information_schema (`hasColumn`) and runtime-safe CBM SQL parts.
  - fallback order for CBM calc: `cbm_m3` -> `volume_ml` -> `0`.
  - missing-CBM alerts now avoid selecting/grouping non-existent columns (`width_cm`, `length_cm`, `height_cm`, `cbm_m3`).
  - SKU monthly floor calc now handles missing `min_storage_fee_month` safely.

## 2026-03-05 (Storage billing diverse sample dataset for QA)

- [Working folder] `D:\_ÀÛ¾÷Æú´õ_codex`
- [Runtime folder] `wms_test` MySQL + `apps/api` preview API
- [Request] Add diverse sample data so storage billing preview can be tested with varying `sku_count` and `rate_cbm`.
- [DB seed actions]
  - Added warehouses: `WH-BILL-A`, `WH-BILL-B`, `WH-BILL-C`
  - Added clients: `CL-BILL-A`, `CL-BILL-B`
  - Added 10 products (5 per client), lots, and stock balances across 5 scopes.
  - Added active storage rates for scope-priority test:
    - `(WH-BILL-A, CL-BILL-A) => 4500`
    - `(WH-BILL-B, NULL) => 3200`
    - `(NULL, CL-BILL-B) => 5100`
    - `(NULL, NULL) => 2800`
  - Built last 5 days storage snapshots for all active stock scopes.
- [Verification]
  - Preview API (`/api/dashboard/storage/billing/preview?month=2026-03`) returned varied rows:
    - `sku_count`: 1, 2, 3, 4
    - `rate_cbm`: 2800, 3200, 4500, 5000, 5100
  - Confirmed rate priority behavior (`scope > warehouse > client > global`).
- [API behavior] Storage billing rate fallback changed for empty `rateCbm` input.
  - file: `apps/api/src/routes/dashboard.js`
  - priority: `query override > storage_rate_settings > default (DEFAULT_STORAGE_RATE_CBM, default 5000)`
  - response `rates.source` now reports `default_fallback` when default rate is used.
- [API policy] Updated empty-rate fallback policy for storage billing by warehouse type.
  - file: `apps/api/src/routes/dashboard.js`
  - default (no `rateCbm` input + no active storage_rate_settings):
    - normal warehouse: `4000`
    - aircon warehouse (`name/code` contains `¿¡¾îÄÁ` or `aircon`): `5000`
  - if warehouse has `default_cbm_rate` column value (>0), that value takes priority.
