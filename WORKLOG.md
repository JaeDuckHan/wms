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
- [Blocker] Referenced plan path mismatch: expected `.omx/plans/phase1-inbound-inventory-log-hardening.md` under `/home/kowinsblue`, but actual project plan exists in `/mnt/d/_작업폴더_codex/.omx/plans/phase1-inbound-outbound-inventory-log-hardening.md`.
- [Blocker] Worker runtime cwd had no target `package.json`, so typecheck/test/lint/e2e commands were not executable.
- [Result] No confirmed Phase1 source-code implementation in `apps/api` / `apps/web` from that team run.

### 남은 일 (Next)

1. 실행 기준 경로 고정
   - Team/worker 실행 cwd를 `/mnt/d/_작업폴더_codex`로 고정.
2. 계획 파일 경로 정합화
   - 실행 prompt와 실제 plan 파일명/경로를 일치시켜 재실행.
3. Phase1 본작업 수행 (계획서 Step 1~5)
   - 기준식/이벤트 동결 → DB 초기화/샘플 재적재 baseline → API 로그 적재 보강 → UI/API 정합성 맞춤 → 회귀 검증 리포트.
4. 검증 게이트 강제
   - `NEXT_PUBLIC_USE_MOCK=false` 기준으로 API/SQL/UI 교차 검증.
5. 2차 범위 분리 유지
   - tenant/client_id 강제 접근제어는 Phase2로 유지.

### Reference

- Plan: `.omx/plans/phase1-inbound-outbound-inventory-log-hardening.md`
- Open questions: `.omx/plans/open-questions.md`

### 추가 진행 (WSL MySQL / 운영유사 샘플데이터 적재)

- [Env] 실행 환경을 Windows PowerShell 기준에서 **WSL(Ubuntu 24.04 / WSL2)** 기준으로 재정렬.
- [DB check] WSL 내부에서 MySQL 상태 확인:
  - `mysqld` 프로세스 실행 확인
  - `127.0.0.1:3306`, `127.0.0.1:33060` LISTEN 확인
- [Issue] `npm run seed:phase1-integrated` 최초 실행 시 `Access denied for user 'root'@'localhost'` 발생.
- [Action] `.env` DB 계정 사용 가이드 제공(`root` → `wms`) 및 권한 사용자 생성 절차 안내.
- [Issue] 이후 `Table 'wms_test.clients' doesn't exist` 발생.
- [Action] `schema_v1.sql`를 `wms_test`에 재적재하도록 안내 후 테이블 생성 확인.
- [Result] `npm run seed:phase1-integrated` 실행 완료.
- [Validation] `apps/api/sql/seed/seed_phase1_05_validation.sql` 검증 기준 PASS 확인(사용자 보고).
- [Runtime check] API 기동 후 `/health`, `/health/db` 정상 응답(사용자 보고).
- [Git] 변경사항 커밋 완료:
  - Commit: `296c890`
  - Message: `feat(web-api): apply phase1 integrated flow and UI/API updates`
  - Scope: 139 files staged/committed (seed 스크립트 포함)
- [Git push blocker] 현재 세션에서는 GitHub HTTPS 인증 부재로 push 실패(`could not read Username`).
- [Next] 사용자 로컬 터미널(WSL 또는 Windows PowerShell)에서 인증 후 `git push origin main` 진행 필요.

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
