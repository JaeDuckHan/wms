# Flow Test Data Seed

This seed prepares the minimum data needed to manually test the internal WMS flow before Shopee work:

- active client
- active warehouse
- active warehouse location
- admin login
- active product
- active product lot
- available stock balance

Run from `apps/api`:

```powershell
npm run seed:flow-test
```

Default login:

- email: `flow.admin@example.com`
- password: `flow1234`

The seed is repeatable. It reactivates the same natural keys and resets the flow-test stock balance to `FLOW_TEST_AVAILABLE_QTY` or `100` by default.

## Manual Flow

1. Login with the flow test admin account.
2. Create an inbound order at `/inbounds/new`.
3. Add the seeded product, lot, location, and quantity.
4. Open the created inbound detail and run `Submit -> Arrive -> Receive`.
5. Check `/inventory`; stock increases only after `received`.
6. Create an outbound order at `/outbounds/new`.
7. Add the same product, lot, location, and a quantity lower than available stock.
8. Open the created outbound detail and run `Allocate -> Pack -> Ship`.
9. Check `/inventory`; reservation appears at `allocated`, and available stock decreases at `shipped`.
10. Try an outbound quantity greater than available stock; allocation should fail with `INSUFFICIENT_STOCK`.

## Automated API Flow Check

Run from `apps/api`:

```powershell
npm run test:e2e:inventory-flow
```

This script seeds the flow-test data, creates inbound and outbound orders through the API, verifies stock changes at each status, verifies stock transactions, checks the insufficient-stock path, and then cleans up the created test orders.

Optional environment variables:

- `FLOW_TEST_AVAILABLE_QTY`
- `FLOW_TEST_INBOUND_QTY`
- `FLOW_TEST_OUTBOUND_QTY`
- `FLOW_TEST_BASE_URL`
- `FLOW_TEST_ADMIN_EMAIL`
- `FLOW_TEST_ADMIN_PASSWORD`
