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
