import { PageHeader } from "@/components/ui/PageHeader";

export default function GuidePage() {
  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Settings" }, { label: "User Guide" }]}
        title="User Guide"
        subtitle="운영/테스트 시 자주 쓰는 흐름과 정산 관리 기능을 빠르게 확인할 수 있습니다."
      />

      <div className="rounded-xl border bg-white p-6 text-sm text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">1. 기본 흐름</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>로그인 후 `Inbounds`, `Outbounds`, `Inventory`, `Billing` 메뉴를 순서대로 확인합니다.</li>
          <li>목록에서 1건을 열어 상세 화면 로딩과 상태 표시를 점검합니다.</li>
          <li>`Settings`에서 기준정보 CRUD가 정상 동작하는지 확인합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">2. 정산 운영 포인트</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>정산 금액은 KRW 기준으로 생성되며, 환율/이벤트 기준을 확인해야 합니다.</li>
          <li>인보이스 목록/상세에서 KRW와 함께 `Original THB`를 같이 확인할 수 있습니다.</li>
          <li>환율 미등록 시 조회는 가능하지만, 인보이스 생성 시에는 환율 검증이 필요합니다.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">3. 샘플 데이터 관리</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`Create Sample Events`로 월/고객 기준 샘플 이벤트를 생성할 수 있습니다.</li>
          <li>`Sample Data Cleanup`은 `SAMPLE-*` + 미청구(`invoice_id IS NULL`) 데이터만 정리합니다.</li>
          <li>정리 모달에서 삭제 대상 건수(월/고객 기준)를 먼저 확인할 수 있습니다.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">4. 확인 모달이 붙은 액션</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>샘플 이벤트 생성</li>
          <li>초안 재생성</li>
          <li>샘플 데이터 정리</li>
          <li>인보이스 `Issue`</li>
          <li>인보이스 `Mark Paid`</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">5. 권장 운영 순서</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>`Billing Events`에서 대상 월/고객 이벤트를 먼저 검토합니다.</li>
          <li>필요 시 샘플 데이터를 생성하거나 정리합니다.</li>
          <li>`Invoices`에서 인보이스 생성 후, `Issue` → `Mark Paid` 순서로 처리합니다.</li>
        </ol>
      </div>
    </section>
  );
}
