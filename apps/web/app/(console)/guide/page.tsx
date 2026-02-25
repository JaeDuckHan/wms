import { PageHeader } from "@/components/ui/PageHeader";

export default function GuidePage() {
  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Settings" }, { label: "사용 가이드 / Guide" }]}
        title="사용 가이드 / Guide"
        subtitle="주요 메뉴 사용 흐름과 테스트 포인트를 안내합니다. / Provides usage flow and QA checkpoints."
      />

      <div className="rounded-xl border bg-white p-6 text-sm text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">1. 메뉴 안내 / Menu</h2>
        <p className="mt-2">입고, 출고, 재고, 정산, 설정 메뉴에서 주요 기능을 테스트할 수 있습니다.</p>
        <p>You can test core features in Inbounds, Outbounds, Inventory, Billing, and Settings.</p>

        <h2 className="mt-6 text-base font-semibold text-slate-900">2. 설정 CRUD / Settings CRUD</h2>
        <p className="mt-2">고객사, 상품, 창고 화면에서 생성/수정/삭제를 수행하고 카운트 배지 반영을 확인하세요.</p>
        <p>Run create/update/delete in Clients, Products, Warehouses and verify count badges update.</p>

        <h2 className="mt-6 text-base font-semibold text-slate-900">3. 정산 테스트 / Billing</h2>
        <p className="mt-2">인보이스 생성, 발행(Issue), 결제완료(Mark Paid), 상세 확인까지 테스트할 수 있습니다.</p>
        <p>Test invoice generation, issue, mark-paid flow, and invoice detail page.</p>

        <h2 className="mt-6 text-base font-semibold text-slate-900">4. 체크리스트 문서 / Checklist</h2>
        <p className="mt-2">
          상세 체크리스트는 <code>tests/prelaunch_crud_checklist.md</code> 문서를 참고하세요.
        </p>
        <p>For full QA checklist, see <code>tests/prelaunch_crud_checklist.md</code>.</p>
      </div>
    </section>
  );
}
