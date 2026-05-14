# Shopee Order Integration Plan

Date: 2026-05-14

## Purpose

This document defines the Shopee order integration scope before real Shopee API credentials are available. It should be used as the implementation checklist once `partner_id`, `partner_key`, shop authorization, `shop_id`, `access_token`, and `refresh_token` are issued.

Do not store real Shopee keys or tokens in this document. Credentials must be stored only in server-side environment variables or encrypted database fields.

## Current WMS Baseline

The current WMS can already receive platform order metadata in outbound orders:

- `outbound_orders.sales_channel`
- `outbound_orders.order_no`
- `outbound_orders.tracking_no`
- `outbound_items` for product, lot, location, quantity, box type, and box count
- `outbound_boxes` for box number, courier, tracking number, item count, and box status

The accepted outbound workflow is:

1. Create outbound order as `draft` or another non-shipped state.
2. Add item lines.
3. Allocate, pack, then ship from the outbound detail flow.

Shopee imports must not create local WMS orders directly as `shipped`. The API guard already expects the draft-first sequence, and shipment status is where stock deduction and billing-event creation become active.

## First Implementation Slice

The first Shopee slice should be API-only or admin-only. Avoid a broad UI build until the import and idempotency rules are proven.

Recommended MVP:

1. Store Shopee shop connection metadata.
2. Pull order list by update time.
3. Fetch order details for selected `order_sn` values.
4. Map Shopee SKU/model SKU to internal WMS product.
5. Create or update a WMS outbound order without applying shipment stock deduction.
6. Put missing SKU or ambiguous orders into a sync error/hold queue.
7. Record every sync run, request id, and error for retry.

## Shopee API Scope

### Order Import

| Purpose | Shopee API | Method | Path | Notes |
| --- | --- | --- | --- | --- |
| Order list by created/updated time | `v2.order.get_order_list` | GET | `/api/v2/order/get_order_list` | Supports `create_time` or `update_time`, max 15-day range, cursor pagination, optional `order_status`. |
| Full order detail | `v2.order.get_order_detail` | GET | `/api/v2/order/get_order_detail` | Use `order_sn_list`, max 50 order numbers per call. Request optional fields for recipient, item list, package list, shipping carrier, payment info, and invoice data as needed. |
| Ready-to-ship shipment list | `v2.order.get_shipment_list` | GET | `/api/v2/order/get_shipment_list` | Useful for logistics-first processing of `READY_TO_SHIP` or retry shipment orders. |
| Package search | `v2.order.search_package_list` | POST | `/api/v2/order/search_package_list` | Useful when package-level fulfillment is needed before local packing/shipping. |
| Package detail | `v2.order.get_package_detail` | GET | `/api/v2/order/get_package_detail` | Needed for package number and package item detail alignment. |

### Shipment and Tracking

| Purpose | Shopee API | Method | Path | Notes |
| --- | --- | --- | --- | --- |
| Shipping parameter lookup | `v2.logistics.get_shipping_parameter` | GET | `/api/v2/logistics/get_shipping_parameter` | Must be called before `ship_order` to know whether pickup, dropoff, or non-integrated data is required. |
| Arrange shipment | `v2.logistics.ship_order` | POST | `/api/v2/logistics/ship_order` | Shopee recommends calling after required shipping parameters are known. |
| Tracking number lookup | `v2.logistics.get_tracking_number` | GET | `/api/v2/logistics/get_tracking_number` | Tracking can be empty initially; polling may be required. |
| Tracking events | `v2.logistics.get_tracking_info` | GET | `/api/v2/logistics/get_tracking_info` | Use for platform logistics status reconciliation. |
| Shipping document parameter | `v2.logistics.get_shipping_document_parameter` | POST | `/api/v2/logistics/get_shipping_document_parameter` | Determines selectable label/document type. |
| Create shipping document | `v2.logistics.create_shipping_document` | POST | `/api/v2/logistics/create_shipping_document` | Available after tracking number is retrieved. |
| Shipping document result | `v2.logistics.get_shipping_document_result` | POST | `/api/v2/logistics/get_shipping_document_result` | Document is downloadable only after status becomes `READY`. |
| Download shipping document | `v2.logistics.download_shipping_document` | POST | `/api/v2/logistics/download_shipping_document` | Requires a successful prior document creation/result flow. |

### Cancellation, Returns, and Settlement Reference

| Purpose | Shopee API | Method | Path | Notes |
| --- | --- | --- | --- | --- |
| Seller cancellation | `v2.order.cancel_order` | POST | `/api/v2/order/cancel_order` | Only before shipment; local WMS reservation rollback must be handled carefully. |
| Buyer cancellation handling | `v2.order.handle_buyer_cancellation` | POST | `/api/v2/order/handle_buyer_cancellation` | Maps to cancellation review workflow, not blind local deletion. |
| Return list | `v2.returns.get_return_list` | GET | `/api/v2/returns/get_return_list` | Second slice; maps to WMS return order import. |
| Return detail | `v2.returns.get_return_detail` | GET | `/api/v2/returns/get_return_detail` | Maps return items to `return_items` after SKU mapping. |
| Accounting detail | `v2.payment.get_escrow_detail` | GET | `/api/v2/payment/get_escrow_detail` | Use for settlement/reconciliation reference, not as WMS 3PL billing source. |

## Required Credential and Token Model

Minimum server-side configuration:

- `SHOPEE_PARTNER_ID`
- `SHOPEE_PARTNER_KEY`
- `SHOPEE_API_BASE_URL`
- `SHOPEE_REDIRECT_URL`

Per connected shop:

- platform name: `shopee`
- client id
- shop id
- region
- access token
- access token expiry
- refresh token
- refresh token expiry
- connection status
- last successful sync timestamp
- last sync error

Shopee common request parameters include `partner_id`, `timestamp`, `access_token`, `shop_id`, and `sign`. The signature is generated from the partner id, API path, timestamp, access token, shop id, and partner key using HMAC-SHA256.

## WMS Mapping Rules

### Order Header

| Shopee field | WMS target | Rule |
| --- | --- | --- |
| `order_sn` | `outbound_orders.order_no` | Must be unique per platform shop. |
| shop/channel | `outbound_orders.sales_channel` | Use `Shopee` or `Shopee:<shop_id>` depending on multi-shop needs. |
| `create_time` or `pay_time` | `outbound_orders.order_date` | Store as `YYYY-MM-DD`; keep full timestamp in sync metadata. |
| shipping carrier | `outbound_orders.tracking_no` or `outbound_boxes.courier` | Prefer box/package-level storage when package data exists. |
| tracking number | `outbound_orders.tracking_no` and/or `outbound_boxes.tracking_no` | Store order-level fallback plus package/box-level details. |
| order status | `outbound_orders.status` | Never import directly as `shipped` unless local stock effects are intentionally applied. |

### Order Items

Shopee detail fields to keep for mapping:

- `item_id`
- `item_name`
- `item_sku`
- `model_id`
- `model_name`
- `model_sku`
- `model_quantity_purchased`
- `order_item_id`
- `product_location_id`

Mapping priority:

1. Match explicit platform SKU mapping table by `shop_id + item_id + model_id`.
2. Match by `model_sku` to internal `products.sku_code`.
3. Match by `item_sku` to internal `products.sku_code`.
4. If still unmatched, create a sync error and do not create stock-affecting outbound items.

The current WMS item creation requires product, lot, and optional location. Shopee does not provide WMS lot/location, so the first import should either:

- create the outbound order header only and hold item creation until a warehouse user allocates lot/location, or
- create item demand lines only after a default allocation policy is explicitly implemented.

Recommended MVP: create header plus mapped item demand in a non-shipped state, then let the existing allocation flow pick lot/location.

## Status Mapping

| Shopee status | Initial WMS status | Notes |
| --- | --- | --- |
| `UNPAID` | do not import by default | Not yet paid; optional reference-only sync. |
| `READY_TO_SHIP` | `confirmed` | Main import target. Requires SKU mapping. |
| `PROCESSED` | `packed` or review queue | Only if Shopee shipment has already been arranged; otherwise keep review. |
| `SHIPPED` | review/import reference | Avoid automatic local `shipped` unless WMS stock deduction is intentionally applied. |
| `COMPLETED` | `delivered` or reference-only | Usually after delivery; local billing impact must be checked. |
| `IN_CANCEL` | review queue | Requires seller decision or cancellation handling. |
| `CANCELLED` | `cancelled` | Roll back local reservation if order was allocated but not shipped. |

Current WMS has no `hold` status. Use a dedicated sync error/hold queue instead of adding a new outbound status in the first slice.

## Data Model Additions Needed

Suggested tables or equivalent structures:

- `platform_connections`
  - client id, platform, shop id, region, token metadata, status, last sync timestamps
- `platform_sync_runs`
  - platform, shop id, run type, cursor/checkpoint, status, counts, error summary
- `platform_order_links`
  - platform, shop id, order sn, package number, outbound order id, imported status, raw status
- `platform_order_snapshots`
  - raw selected Shopee response JSON for audit/replay
- `platform_sku_mappings`
  - platform, shop id, item id, model id, item SKU, model SKU, internal product id, status
- `platform_sync_errors`
  - order sn, error type, message, retryable flag, resolved flag

Unique idempotency key:

```text
platform + shop_id + order_sn
```

Package-level idempotency key when needed:

```text
platform + shop_id + order_sn + package_number
```

## Sync Flow

1. Scheduler or admin action starts a sync run.
2. Load active Shopee connection and validate token freshness.
3. Refresh token if needed.
4. Call `get_order_list` with `time_range_field=update_time`.
5. Page through cursor until complete.
6. Fetch detail in batches using `get_order_detail`.
7. Upsert platform order link and snapshot.
8. Resolve SKU mappings.
9. If all required mappings exist, create or update WMS outbound order.
10. If mapping or required data is missing, write sync error and keep order out of stock-affecting flow.
11. Record run result, counts, request ids, and checkpoint.

## Shipment Flow

Shipment should be controlled from WMS after local warehouse processing:

1. WMS order is packed or ready to ship.
2. Fetch Shopee shipping parameters for `order_sn` and optional `package_number`.
3. Submit `ship_order` with pickup/dropoff/non-integrated payload.
4. Poll `get_tracking_number` if the response does not immediately include tracking.
5. Store tracking at order and package/box level.
6. Create shipping document task after tracking number is available.
7. Poll document result until `READY`.
8. Download label/document and expose it to warehouse users.
9. Mark local shipment only after local stock and Shopee shipment state are consistent.

## Billing and Settlement Boundary

Shopee payment and escrow APIs are not the same as WMS 3PL billing.

Current WMS billing events are based on WMS operational events such as outbound shipment. Shopee `get_escrow_detail` should be used for settlement reconciliation or client reporting only. It should not directly replace `billing_events` or invoice generation unless a separate platform settlement feature is designed.

## Security and Operations

- Never expose partner key, access token, refresh token, or raw signed URL to the browser.
- Store encrypted tokens server-side.
- Log Shopee request ids and error codes, but redact credentials.
- Support manual disconnect and reauthorization.
- Use rate-limit aware retry with backoff.
- Keep a manual resync option by date range for operations.
- Keep `OPTIONS` and browser proxy allowlists truthful if new API routes are exposed through the web app.

## Acceptance Criteria

Minimum acceptance before enabling real shop sync:

- A fixture Shopee order imports once.
- Re-importing the same order does not create a duplicate WMS outbound order.
- Missing SKU mapping creates a visible sync error and does not deduct stock.
- `READY_TO_SHIP` maps to a non-shipped WMS state.
- Local `shipped` still requires the existing WMS shipment flow.
- Token expiry is detected and refresh is attempted.
- A failed Shopee API response is logged with request id and retry status.
- Manual resync over a selected date range works.
- Shipment parameter lookup and tracking number retrieval are tested with fixture or sandbox data.

## Implementation Order

1. Add schema for connections, order links, snapshots, mappings, sync runs, and sync errors.
2. Add Shopee signer/client service with token refresh support.
3. Add fixture-based mapper tests for order detail to WMS draft/confirmed import input.
4. Add dry-run import endpoint that returns mapping results without writing WMS orders.
5. Add real import endpoint gated by admin role and active connection.
6. Add sync status and error visibility in settings/admin UI.
7. Add logistics shipment and tracking sync after order import is stable.
8. Add returns and settlement reconciliation as separate follow-up slices.

## Open Questions Before Coding

- Should imported Shopee orders start as `draft` or `confirmed`?
- Should WMS add a formal `hold` state, or keep hold as a separate sync error queue?
- Which internal field is the canonical SKU match: `products.sku_code`, `barcode_raw`, or a new platform mapping table only?
- How should lot and warehouse location be selected for imported orders?
- Are there multiple Shopee shops per WMS client?
- Which region and Shopee environment will be used first?
- Should labels be stored in the database, filesystem, object storage, or downloaded on demand?

## Official References

- Shopee `v2.order.get_order_list`: https://open.shopee.com/documents/v2/v2.order.get_order_list?module=94&type=1
- Shopee `v2.order.get_order_detail`: https://open.shopee.com/documents/v2/v2.order.get_order_detail?module=94&type=1
- Shopee `v2.logistics.ship_order`: https://open.shopee.com/documents/v2/v2.logistics.ship_order?module=95&type=1
- Shopee `v2.returns.get_return_list`: https://open.shopee.com/documents/v2/v2.returns.get_return_list?module=102&type=1
- Shopee `v2.payment.get_escrow_detail`: https://open.shopee.com/documents/v2/v2.payment.get_escrow_detail?module=97&type=1

