import { PageHeader } from "@/components/ui/PageHeader";

export default function GuidePage() {
  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Settings" }, { label: "User Guide" }]}
        title="User Guide"
        subtitle="처음 사용하는 운영자도 바로 업무를 시작할 수 있도록 화면별 기능, 실제 사용 순서, 문제 해결 방법을 정리했습니다."
      />

      <div className="rounded-xl border bg-white p-6 text-sm text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">1. 시작 전 체크</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>로그인 후 좌측 메뉴가 `입고 / 출고 / 재고 / 정산 / 대시보드 / 설정`으로 보이는지 확인합니다.</li>
          <li>각 메뉴에서 목록이 1건 이상 보이는지 먼저 확인하고, 0건이면 필터를 초기화한 뒤 다시 조회합니다.</li>
          <li>운영 기준정보(`고객사`, `상품`, `창고`, `요율`)가 최신인지 `Settings`에서 먼저 점검합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">2. 메뉴별 핵심 기능</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`Inbounds(입고)`: 입고 접수, 상태 변경(도착/입고완료), 입고 품목 확인.</li>
          <li>`Outbounds(출고)`: 출고 지시, 피킹/패킹/출고완료 상태 관리, 박스/송장 정보 확인.</li>
          <li>`Inventory(재고)`: 현재고, 가용수량, 거래 이력 확인(입출고 반영 여부 점검).</li>
          <li>`Billing Events(정산 이벤트)`: 과금 대상 이벤트(PENDING/INVOICED) 검토.</li>
          <li>`Invoices(인보이스)`: 청구서 생성, 발행(Issue), 수납완료(Mark Paid) 처리.</li>
          <li>`Dashboard`: 보관 추이, 보관 요금, 창고 적재율 모니터링.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">3. 정산(Billing) 상세 사용법</h2>
        <h3 className="mt-3 font-semibold text-slate-900">3-1. Billing Events 화면</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>기본 조회는 `해당년도 + 당월`입니다.</li>
          <li>년도와 월을 함께 선택하면 해당 월만 조회됩니다.</li>
          <li>년도만 선택하고 월을 비우면 해당년도 전체 이벤트가 조회됩니다.</li>
          <li>월/고객/상태/서비스코드 필터로 대상 이벤트를 좁혀 검토합니다.</li>
          <li>`PENDING`은 아직 청구 전 이벤트, `INVOICED`는 인보이스에 이미 포함된 이벤트입니다.</li>
          <li>관리자 권한이면 선택 이벤트를 `Mark as Pending`으로 되돌릴 수 있습니다.</li>
          <li>`Export CSV`로 현재 필터 결과를 바로 내보낼 수 있습니다.</li>
        </ul>

        <h3 className="mt-4 font-semibold text-slate-900">3-2. Invoices 화면</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>기간 검색은 `시작일 ~ 종료일` 달력으로 조회합니다.</li>
          <li>종료일은 인보이스 생성 기준일로도 사용됩니다(청구월도 종료일 기준 파생).</li>
          <li>조회 시 `Client ID`를 비우면 전체 고객 조회, 입력하면 해당 고객만 조회합니다.</li>
          <li>인보이스 생성/샘플 생성/샘플 정리는 `Client ID` 입력이 필요합니다.</li>
          <li>상태 흐름은 `draft`에서 `issued`, `paid` 순서로 진행됩니다.</li>
          <li>금액은 KRW 기준이며 `Original THB`로 환산 전 금액도 함께 확인할 수 있습니다.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">4. 샘플 데이터 관리</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`Create Sample Events`로 월/고객 기준 샘플 이벤트를 생성할 수 있습니다.</li>
          <li>`Sample Data Cleanup`은 `SAMPLE-*` + 미청구(`invoice_id IS NULL`) 데이터만 정리합니다.</li>
          <li>정리 모달에서 삭제 대상 건수(월/고객 기준)를 먼저 확인할 수 있습니다.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">5. 확인 모달이 붙은 액션</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>샘플 이벤트 생성</li>
          <li>초안 재생성</li>
          <li>샘플 데이터 정리</li>
          <li>인보이스 `Issue`</li>
          <li>인보이스 `Mark Paid`</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">6. 초보자용 권장 운영 순서(실무 기준)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>`Settings`에서 고객/상품/창고/요율이 최신인지 확인합니다.</li>
          <li>`Inbounds/Outbounds`에서 당일 처리 건의 상태가 정상 반영됐는지 확인합니다.</li>
          <li>`Inventory`에서 재고 반영 이상(음수/누락)이 없는지 점검합니다.</li>
          <li>`Billing Events`에서 대상 월/고객 이벤트를 확인하고 이상 건을 정리합니다.</li>
          <li>`Invoices`에서 기간+고객 기준으로 생성/검토 후 `Issue` 다음 `Mark Paid` 순으로 처리합니다.</li>
          <li>필요 시 CSV 내보내기로 정산 검증 자료를 보관합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">7. 데이터가 안 보일 때(0건) 점검 순서</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>년도/월 필터를 조정해서 다시 조회합니다. (당월에 데이터가 없을 수 있습니다)</li>
          <li>기간이 너무 좁지 않은지 확인합니다. (예: 올해 1월 1일 ~ 오늘)</li>
          <li>`Client ID`가 잘못 입력되지 않았는지 확인합니다.</li>
          <li>샘플 데이터가 필요하면 `Create Sample Events`를 실행합니다.</li>
          <li>여전히 0건이면 API `/health/db`의 billing readiness를 확인합니다.</li>
        </ol>
      </div>
    </section>
  );
}
