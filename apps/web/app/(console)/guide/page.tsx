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
          <li>상단 데이터 모드 배지(`LIVE`, `LIVE DEV`, `MOCK`, `FALLBACK DEV`)가 현재 검증하려는 환경과 일치하는지 확인합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">2. 메뉴별 핵심 기능</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`Inbounds(입고)`: 입고 오더 목록 조회, 상세 확인, 상태 변경(Submit/Arrive/Receive), 입고 품목과 타임라인 점검.</li>
          <li>`Outbounds(출고)`: 출고 오더 목록 조회, 상세 확인, 할당/패킹/출고완료 처리, 박스/송장 정보 확인, 할당 제안 점검.</li>
          <li>`Inventory(재고)`: 현재고, 가용수량, 거래 이력 확인(입출고 반영 여부 점검).</li>
          <li>`Billing Events(정산 이벤트)`: 과금 대상 이벤트(PENDING/INVOICED) 검토.</li>
          <li>`Invoices(인보이스)`: 청구서 생성, 초안 재생성, 발행(Issue), 수납완료(Mark Paid), 출력 파일 확인.</li>
          <li>`Dashboard`: 보관 추이, 보관 요금, 창고 적재율 모니터링과 CSV/클립보드/PNG 내보내기.</li>
          <li>`Settings`: 고객사, 상품, 창고, 서비스요율, 계약요율, 보관요율, 환율 관리.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">3. 실무 흐름 예시</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            `기존 업체의 상품을 추가`하려면 먼저 `Settings &gt; Clients`에서 고객사 코드와 회사명이 맞는지 확인한 뒤, `Settings &gt; Products`에서 상품을 등록합니다.
            상품 추가 창에서는 이제 고객사 코드 입력 시 회사명이 함께 보여서 어느 업체인지 바로 확인할 수 있습니다.
          </li>
          <li>
            `기존 상품의 입고 처리`는 고객사/상품 마스터가 준비된 상태에서 진행합니다.
            현재 웹 콘솔은 입고 오더의 신규 작성보다 목록/상세/상태 처리 중심이므로, 생성된 입고 오더를 `Inbounds`에서 열어 `Submit -&gt; Arrive -&gt; Receive` 순으로 반영하는 흐름으로 이해하면 됩니다.
          </li>
          <li>
            `입고 후 출고 처리`는 먼저 `Inventory`에서 재고 반영을 확인한 다음, `Outbounds` 상세에서 `Allocate -&gt; Pack -&gt; Ship` 순으로 이어집니다.
            출고 상세에서는 부족수량과 재할당 필요 여부를 함께 봐야 합니다.
          </li>
          <li>
            `청구`는 `Billing Events`에서 월/고객 기준 이벤트를 확인한 뒤 `Invoices`에서 생성, 발행, 수납완료 순으로 처리합니다.
          </li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">4. 정산(Billing) 상세 사용법</h2>
        <h3 className="mt-3 font-semibold text-slate-900">4-1. Billing Events 화면</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>기본 조회는 `해당년도 전체`입니다.</li>
          <li>년도와 월을 함께 선택하면 해당 월만 조회됩니다.</li>
          <li>년도만 선택하고 월을 비우면 해당년도 전체 이벤트가 조회됩니다.</li>
          <li>고객 입력칸은 `Client ID` 기준이지만, 입력하면 고객사 코드와 회사명을 함께 확인할 수 있습니다.</li>
          <li>월/고객/상태/서비스코드 필터로 대상 이벤트를 좁혀 검토합니다.</li>
          <li>`PENDING`은 아직 청구 전 이벤트, `INVOICED`는 인보이스에 이미 포함된 이벤트입니다.</li>
          <li>관리자 권한이면 선택 이벤트를 `Mark as Pending`으로 되돌릴 수 있습니다.</li>
          <li>`Export CSV`로 현재 필터 결과를 바로 내보낼 수 있습니다.</li>
        </ul>

        <h3 className="mt-4 font-semibold text-slate-900">4-2. Invoices 화면</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>기간 검색은 `시작일 ~ 종료일` 달력으로 조회합니다.</li>
          <li>종료일은 인보이스 생성 기준일로도 사용됩니다(청구월도 종료일 기준 파생).</li>
          <li>조회 시 `Client ID`를 비우면 전체 고객 조회, 입력하면 해당 고객만 조회합니다.</li>
          <li>인보이스 생성/샘플 생성/샘플 정리는 `Client ID` 입력이 필요하며, 입력창 아래에서 고객사 코드와 회사명을 같이 확인할 수 있습니다.</li>
          <li>상태 흐름은 `draft`에서 `issued`, `paid` 순서로 진행됩니다.</li>
          <li>금액은 KRW 기준이며 `Original THB`로 환산 전 금액도 함께 확인할 수 있습니다.</li>
          <li>상세 화면에서는 `Export Invoice`와 관리자 전용 `Duplicate (Admin)` 기능을 사용할 수 있습니다.</li>
        </ul>

        <h3 className="mt-4 font-semibold text-slate-900">4-3. 정산 실무 사용 순서</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>`Billing Events`에서 대상 연도와 월, 고객사를 선택해 이번 달 청구 대상 이벤트가 맞는지 먼저 확인합니다.</li>
          <li>잘못 청구된 이벤트가 있으면 관리자 권한으로 `Mark as Pending (Admin)`을 사용해 인보이스 묶음을 풀어 줍니다.</li>
          <li>`Invoices`로 이동해 같은 고객과 기준일로 조회한 뒤 `Generate` 또는 `Re-generate Draft`를 실행합니다.</li>
          <li>생성된 초안에서 품목별 금액, 환율, 총액을 확인하고 이상이 없으면 `Issue`로 발행합니다.</li>
          <li>실제 수금까지 끝나면 `Mark Paid`로 수납 완료 처리하고, 필요하면 `Export Invoice`로 전달본을 저장합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">5. 샘플 데이터 관리</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`Create Sample Events`로 월/고객 기준 샘플 이벤트를 생성할 수 있습니다.</li>
          <li>`Sample Data Cleanup`은 `SAMPLE-*` + 미청구(`invoice_id IS NULL`) 데이터만 정리합니다.</li>
          <li>정리 모달에서 삭제 대상 건수(월/고객 기준)를 먼저 확인할 수 있습니다.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">6. Dashboard와 설정에서 자주 쓰는 기능</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`Dashboard`에서는 Demo Mode 기준으로 `Generate Snapshots`를 실행할 수 있습니다.</li>
          <li>`Storage Trend`, `Storage Billing`, `Capacity` 화면에서 CSV 다운로드, 클립보드 복사, PNG 캡처를 사용할 수 있습니다.</li>
          <li>`Settings`에서는 공통 기준정보 외에 `Service Rates`, `Contract Rates`, `Storage Rates`, `Exchange Rates`를 관리합니다.</li>
          <li>`Billing Settings` 수정 권한은 관리자에게만 있습니다.</li>
        </ul>

        <h3 className="mt-4 font-semibold text-slate-900">6-1. 대시보드 실무 사용 순서</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>`Dashboard` 또는 `Storage Trend`에서 고객사, 창고, 기간을 먼저 맞춰 현재 재고 흐름과 보관 추이를 확인합니다.</li>
          <li>데이터가 비어 있으면 `Generate Snapshots`를 먼저 실행한 뒤 다시 조회합니다.</li>
          <li>`Storage Billing`에서는 같은 고객과 월 조건으로 보관요금 예상치가 정산 결과와 크게 어긋나지 않는지 비교합니다.</li>
          <li>`Capacity`에서는 특정 창고가 과적 상태인지, 운영상 추가 조치가 필요한지 확인합니다.</li>
          <li>검증 결과를 공유할 때는 CSV 다운로드, 클립보드 복사, PNG 캡처를 사용합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">7. 확인 모달이 붙은 액션</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>샘플 이벤트 생성</li>
          <li>초안 재생성</li>
          <li>샘플 데이터 정리</li>
          <li>인보이스 `Issue`</li>
          <li>인보이스 `Mark Paid`</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">8. 초보자용 권장 운영 순서(실무 기준)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>`Settings`에서 고객/상품/창고/요율이 최신인지 확인합니다.</li>
          <li>`Inbounds/Outbounds`에서 당일 처리 건의 상태가 정상 반영됐는지 확인합니다.</li>
          <li>`Inventory`에서 재고 반영 이상(음수/누락)이 없는지 점검합니다.</li>
          <li>`Billing Events`에서 대상 월/고객 이벤트를 확인하고 이상 건을 정리합니다.</li>
          <li>`Invoices`에서 기간+고객 기준으로 생성/검토 후 `Issue` 다음 `Mark Paid` 순으로 처리합니다.</li>
          <li>필요 시 Dashboard와 Billing에서 CSV/PNG 내보내기로 검증 자료를 보관합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">9. 빠른 테스트 방법</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>관리자 계정으로 로그인 후 `입고 / 출고 / 재고 / 정산 / 대시보드 / 설정` 메뉴 노출을 확인합니다.</li>
          <li>`Billing Events`에서 CSV 내보내기, `Invoices`에서 `Generate`, `Issue`, `Mark Paid` 순서를 확인합니다.</li>
          <li>`Dashboard`에서 스냅샷 생성, CSV 다운로드, 클립보드 복사, PNG 캡처를 확인합니다.</li>
          <li>`client_viewer` 계정으로 다시 로그인해 `Inbounds`, `Settings`가 보이지 않는지 확인합니다.</li>
          <li>더 자세한 수동/자동 테스트 명령은 `docs/user-guide-ko.md`를 참고합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">10. 데이터가 안 보일 때(0건) 점검 순서</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>년도/월 필터를 조정해서 다시 조회합니다. (당월에 데이터가 없을 수 있습니다)</li>
          <li>기간이 너무 좁지 않은지 확인합니다. (예: 올해 1월 1일 ~ 오늘)</li>
          <li>`Client ID`가 잘못 입력되지 않았는지 확인합니다.</li>
          <li>샘플 데이터가 필요하면 `Create Sample Events`를 실행합니다.</li>
          <li>Dashboard가 비면 `Generate Snapshots`를 먼저 실행해 봅니다.</li>
          <li>여전히 0건이면 API `/health/db`의 billing readiness를 확인합니다.</li>
        </ol>
      </div>
    </section>
  );
}
