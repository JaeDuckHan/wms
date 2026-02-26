import { PageHeader } from "@/components/ui/PageHeader";

export default function GuidePage() {
  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Settings" }, { label: "Guide" }]}
        title="User Guide / Guide"
        subtitle="Provides usage flow and full QA checklist on this page."
      />

      <div className="rounded-xl border bg-white p-6 text-sm text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">1. Menu</h2>
        <p className="mt-2">
          You can test core features in Inbounds, Outbounds, Inventory, Billing, and Settings.
        </p>

        <h2 className="mt-6 text-base font-semibold text-slate-900">2. Settings CRUD</h2>
        <p className="mt-2">
          Run create/update/delete in Clients, Products, Warehouses and verify count badges update.
        </p>

        <h2 className="mt-6 text-base font-semibold text-slate-900">3. Billing</h2>
        <p className="mt-2">
          Test invoice generation, issue, mark-paid flow, and invoice detail page.
        </p>

        <h2 className="mt-6 text-base font-semibold text-slate-900">4. Full QA Checklist</h2>
        <p className="mt-2">Prelaunch CRUD Checklist (20 Samples per Menu)</p>

        <h3 className="mt-4 font-semibold text-slate-900">Scope</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Inbounds</li>
          <li>Outbounds</li>
          <li>Inventory &gt; Balances</li>
          <li>Inventory &gt; Transactions</li>
          <li>Settings &gt; Clients</li>
          <li>Settings &gt; Products</li>
          <li>Settings &gt; Warehouses</li>
        </ul>

        <h3 className="mt-4 font-semibold text-slate-900">Pre-check</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Login with a valid account.</li>
          <li>Open each menu and confirm at least 20 rows are visible (without search filter).</li>
          <li>Confirm filter badges/counters are consistent with row counts.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">Inbounds</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open list and verify 20 rows.</li>
          <li>Open one row detail and verify overview/items/timeline render.</li>
          <li>Run one status action and confirm list/detail status sync.</li>
          <li>Search by inbound number and client name, verify filtered result.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">Outbounds</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open list and verify 20 rows.</li>
          <li>Open one row detail and verify overview/items/boxes/timeline render.</li>
          <li>Add one box, confirm box list count increments.</li>
          <li>Run one status action and verify list/detail status sync.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">Inventory</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Open Balances and verify 20 rows.</li>
          <li>Open Transactions and verify 20 rows.</li>
          <li>
            Apply txn_type filter (inbound_receive, outbound_ship, return_receive), verify row set
            changes correctly.
          </li>
          <li>Run search on product/client keyword and verify filtered rows.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">Settings &gt; Clients</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Confirm initial list includes 20 samples.</li>
          <li>Create one new client, verify row count +1 and counters updated.</li>
          <li>Edit the created row, verify changed fields persist.</li>
          <li>Delete that row, verify row removed and counters rollback.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">Settings &gt; Products</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Confirm initial list includes 20 samples.</li>
          <li>Create one new product and verify count/counters.</li>
          <li>Edit product name/status and verify persistence.</li>
          <li>Delete the edited row and verify counters rollback.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">Settings &gt; Warehouses</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Confirm initial list includes 20 samples.</li>
          <li>Create one warehouse and verify count/counters.</li>
          <li>Edit warehouse name/status and verify persistence.</li>
          <li>Delete the edited row and verify counters rollback.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">Regression Focus</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>No page should show empty state before any user action.</li>
          <li>After create/update/delete/toggle, list and counters must stay in sync.</li>
          <li>Search + status filter + sorting should not break counters.</li>
          <li>
            Refresh browser and confirm persisted API/mock state behavior is expected for your
            environment.
          </li>
        </ol>
      </div>
    </section>
  );
}
