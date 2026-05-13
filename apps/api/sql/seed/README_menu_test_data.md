# Menu Test Data Seed

This seed prepares current-date data for manual testing across the console menus.

Run from `apps/api`:

```powershell
npm run seed:menu-test
```

Default test accounts:

- admin: `menu.admin@example.com` / `menu1234`
- manager: `menu.manager@example.com` / `menu1234`
- client viewer: `menu.client@example.com` / `menu1234`

Seeded keys:

- client: `MENU-CL-001`
- warehouse: `MENU-WH-001`
- locations: `MENU-A-01`, `MENU-B-01`
- products: `MENU-CL-001-MENUTEST001`, `MENU-CL-001-MENUTEST002`, `MENU-CL-001-MENUMANUAL001`
- inbound orders: `MENU-INB-YYYYMMDD-*`
- outbound orders: `MENU-OUT-YYYYMMDD-*`

What it covers:

- Settings: active client, warehouse, locations, products, service catalog, price policies, exchange rate.
- Product manual test: users can add another product under `MENU-CL-001` and use it in new inbound/outbound forms.
- Inbounds: draft, arrived, and received examples with current-month dates.
- Inventory: balances plus `inbound_receive`, `outbound_ship`, `return_restock`, and `return_dispose` transactions.
- Outbounds: draft, allocated, packed, and shipped examples with current-month dates.
- Billing: current-month pending billing events ready for invoice generation, plus a previous-month issued invoice when the schema supports standalone `/billing/*` invoices.
- Dashboard: seven days of storage snapshots for trend, storage billing, and capacity views.

The seed is repeatable. It only resets rows under the `MENU-*` natural keys and the current-month invoice for `MENU-CL-001` so the invoice generation flow can be tested again.
