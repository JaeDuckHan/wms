# Billing UX Flow Checklist

This document is the single checklist for end-to-end Billing UX validation.

## Scope

- Console navigation entry
- Billing tabs order and movement
- Billing Events search/action flow
- Invoices search/generate/action flow
- Interaction affordance (cursor/hover/disabled)

## Canonical flow

1. Sidebar `Billing` click lands on `/billing/events`.
2. Billing tab order is `Billing Events` then `Invoices`.
3. User reviews/filters events first.
4. User moves to invoices and searches by date range.
5. User generates/re-generates invoice and applies state actions.

## Checklist

### Navigation

- [ ] Sidebar Billing route points to `/billing/events`.
- [ ] Billing menu remains active on `/billing*` pages.
- [ ] Billing tabs appear in this order:
  - [ ] `/billing/events` (Billing Events)
  - [ ] `/billing` (Invoices)

### Billing Events

- [ ] `Search` calls billing events query with current filters.
- [ ] `Export CSV` downloads filtered dataset.
- [ ] Admin-only bulk action is visible only for admin role.

### Invoices

- [ ] Date filters are calendar pickers (`type="date"`).
- [ ] `Search` sends `invoice_date_from` and `invoice_date_to`.
- [ ] Invalid range (`from > to`) is blocked with message.
- [ ] `Generate` uses end date for `invoice_date` and `invoice_month`.
- [ ] `Re-generate Draft` asks confirmation before execution.
- [ ] Row actions (`Issue`, `Mark Paid`) ask confirmation.

### Interaction / usability

- [ ] Enabled buttons show pointer cursor.
- [ ] Disabled buttons show not-allowed cursor and reduced opacity.
- [ ] Hover state is visible on interactive controls.

## Quick test commands

```bash
cd apps/web
npm run typecheck
npm run i18n:check
```

## Related files

- `apps/web/components/layout/Sidebar.tsx`
- `apps/web/components/billing/BillingTabs.tsx`
- `apps/web/features/billing/BillingEventsPage.tsx`
- `apps/web/features/billing/BillingInvoicesPage.tsx`
- `apps/web/components/ui/button.tsx`
