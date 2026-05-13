# Shopee API Integration Functional Gap Review

Date: 2026-05-13
Source: `Kowinsblue 3PL Platform PRD v3.3.docx` extracted to `.omx/prd_v33_extracted.md`

## Summary

The PRD defines the overall operating direction well, but it is still broad for implementation. For Shopee-first work, the missing pieces are mostly around API account management, token lifecycle, order idempotency, SKU mapping, platform status mapping, failure recovery, and test acceptance criteria.

Current WMS already has a basic outbound structure that can receive imported Shopee orders through `sales_channel`, `order_no`, and `tracking_no`. However, Shopee-specific account, token, mapping, sync-run, and retry/log tables are not present yet.

## Functional Gaps

### 1. Shopee MVP Scope Needs Separation

The PRD groups order pull, invoice/tracking push, and stock push together. For implementation, these should be separated:

1. Order pull and detail fetch
2. SKU mapping to internal products
3. WMS outbound order creation
4. Shipment/tracking push
5. Platform stock push

Recommended first slice: `Shopee order pull -> order detail -> SKU mapping -> WMS outbound order in confirmed/hold state`.

### 2. Token and API Account Management Is Underspecified

Required but not fully defined:

- Platform account table by client/shop/platform
- Shopee `partner_id`, shop id, access token, refresh token, expiry timestamps
- Automatic token refresh
- Reauthorization flow when refresh token expires
- Connection status: connected, token expired, sync error, disconnected
- API permission visibility and last successful sync time

### 3. Order Sync Idempotency Is Missing

Shopee sync needs clear duplicate prevention:

- Unique key: `platform + shop_id + order_sn`
- Sync checkpoint by `update_time`
- Cursor pagination storage
- Manual resync range
- Retry after partial failure
- No-op behavior when the same order is fetched again
- Conflict policy when platform order detail changes after import

### 4. Status Mapping Needs Alignment With Current WMS

The PRD uses states such as `Pending`, `Approved`, `Packing`, `Completed`, and `Hold`.

Current API outbound states are:

- `draft`
- `confirmed`
- `allocated`
- `picking`
- `packed`
- `shipped`
- `delivered`
- `cancelled`

Before implementation, define a Shopee-to-WMS mapping. Safer initial mapping:

| Shopee state | Initial WMS handling |
| --- | --- |
| READY_TO_SHIP | `confirmed` if SKU mapping exists; `hold` equivalent if mapping fails |
| PROCESSED | manual review or `packed` only if shipment has been arranged |
| SHIPPED | import for reference only unless stock effect is already controlled |
| COMPLETED | `delivered` or settlement reference state |
| CANCELLED | `cancelled` |

Current schema does not include a `hold` outbound state, so either a new state or a separate sync error/hold queue is needed.

### 5. Platform SKU Mapping Requires Dedicated Data Model

The PRD mentions Product Mapping, but current schema only has internal product fields such as `sku_code`, `barcode_raw`, and `barcode_full`.

Needed:

- `platform_sku_mappings`
- Platform name, shop id, item id, model id, item SKU, model SKU
- Internal product id
- Optional bundle/set mapping
- Active/inactive status
- Change history
- Missing-mapping queue

Mapping failure must not create stock deduction or shipment.

### 6. Shipment and Tracking Flow Needs More Detail

The PRD says "송장 업로드", but actual Shopee logistics can require shipping parameters, package number, logistics status, tracking number retrieval, label/shipping document creation, and retry handling.

Needed:

- Shipment action state separate from local outbound status
- Tracking upload/retrieval log
- Courier/platform logistics channel mapping
- Duplicate tracking submission prevention
- Failed shipment push retry

### 7. Packing Proof and QC Attachment Model Is Incomplete

The PRD requires packing photos, weight, and QC evidence. Current DB has a generic `files` table, but no clear relation from file to outbound order, box, packing proof, or QC step.

Needed:

- Packing proof table
- QC checklist/status table
- File attachment relation by outbound order and box
- Required photo policy by service type/platform
- Weight capture and mismatch rule
- QC failure and rework flow

### 8. Cancellation, Partial Shipment, and Return Sync Need More Detail

Returns exist in the WMS, but platform-driven return and cancellation flows are not specified enough.

Needed:

- Platform cancellation before allocation
- Cancellation after allocation with reserved stock release
- Partial shipment/backorder policy
- Shopee return request import
- Return tracking and reverse logistics
- Return QC result to stock state
- Refund/return settlement adjustment

### 9. Platform Settlement Matching Rules Are Missing

The PRD mentions platform settlement CSV upload, but implementation needs strict matching and exception handling.

Needed:

- CSV template/version per platform
- Matching key: order number, package number, settlement id
- Platform fee, campaign discount, voucher, advertising fee, refund, COD handling
- Duplicate settlement row detection
- Unmatched settlement queue
- Reconciliation report by client/month/platform

### 10. Acceptance Criteria and Test Cases Are Missing

Shopee-first implementation needs explicit pass/fail criteria.

Minimum test criteria:

- Sandbox or fixture order can be imported once
- Re-importing the same order does not create duplicates
- Missing SKU mapping creates hold/error record
- Token expiry is detected and refresh is attempted
- Manual resync works for a selected date range
- Order detail maps item quantity correctly
- WMS order creation does not apply shipment stock deduction prematurely
- Sync failure is visible in API Settings/Dashboard

## Current Site New-Creation Status

Updated on 2026-05-13:

- Settings > Clients: supports `New client`
- Settings > Products: supports `New product`
- Settings > Warehouses: supports `New warehouse`
- Billing settings: supports new service/contract/storage/exchange-rate entries for admin-oriented pages
- Inbounds list: now has `New` and `/inbounds/new`
- Outbounds list: now has `New` and `/outbounds/new`

Inbound/outbound creation is intentionally draft-first. Users create the draft order and optional item lines, then continue operational status changes from the detail screen.

Internal flow testing should be completed before Shopee implementation:

- `npm run seed:flow-test` from `apps/api` prepares active client, warehouse, location, product, lot, admin login, and available stock.
- `npm run test:e2e:inventory-flow` verifies the API flow: inbound draft has no stock effect, inbound `received` increases stock, outbound `allocated` reserves stock, outbound `shipped` deducts stock, and over-allocation returns `INSUFFICIENT_STOCK`.
- The new inbound/outbound forms use warehouse location selection when seeded locations exist, so testers do not need to manually look up numeric location IDs.

Also, write actions are role-gated:

- API write roles: `admin`, `manager`, `warehouse`
- Client viewer is read-only
- Web hides or disables creation controls when `canWrite` is false

## Recommended Next Step

For Shopee-first work, add an API-only dry-run/import path before adding full UI:

1. Add Shopee account/token/sync/mapping schema
2. Add Shopee client and signer service
3. Add fixture-based order detail mapper
4. Add dry-run import endpoint
5. Add real sync endpoint gated by credentials
6. Add API Settings page after backend behavior is stable
