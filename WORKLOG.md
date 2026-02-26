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
