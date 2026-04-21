import { PageHeader } from "@/components/ui/PageHeader";

import { cookies } from "next/headers";
import { AUTH_COOKIE_KEY, decodeJwtPayload } from "@/lib/auth";
import { isClientViewer } from "@/lib/authz";

export default async function GuidePage() {
  const token = (await cookies()).get(AUTH_COOKIE_KEY)?.value ?? "";
  const payload = decodeJwtPayload<{ role?: string }>(token);

  if (isClientViewer(payload?.role)) {
    return <CustomerGuidePage />;
  }

  return <OperatorGuidePage />;
}

function CustomerGuidePage() {
  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Customer Portal" }, { label: "User Guide" }]}
        title="고객사 사용 가이드"
        subtitle="고객사 계정은 자기 회사의 출고, 재고, 인보이스, 대시보드를 조회하는 읽기 전용 포털입니다."
      />

      <div className="rounded-xl border bg-white p-6 text-sm text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">1. 고객사 계정으로 할 수 있는 일</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`Outbounds`: 우리 회사 출고 오더 상태, 출고 품목, 송장/박스 정보, 부족 여부를 확인합니다.</li>
          <li>`Inventory`: 우리 회사 상품의 현재고, 예약수량, 출고 가능수량, 거래 이력을 확인합니다.</li>
          <li>`Billing`: 우리 회사 인보이스와 상세 금액을 확인합니다.</li>
          <li>`Dashboard`: 보관 추이, 보관 요금 미리보기, 창고 적재율을 조회하고 CSV/복사/PNG로 공유 자료를 추출합니다.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">2. 고객사 계정으로 할 수 없는 일</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`Inbounds`와 `Settings` 메뉴는 보이지 않습니다.</li>
          <li>`Billing Events` 탭은 보이지 않고, `Invoices`만 조회할 수 있습니다.</li>
          <li>입고 처리, 출고 상태 변경, 박스 추가, 인보이스 생성/발행/수납 처리는 할 수 없습니다.</li>
          <li>고객사, 상품, 창고, 요율 같은 기준정보를 수정할 수 없습니다.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">3. 로그인 후 먼저 확인할 것</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>로그인 후 기본 진입 화면이 `Billing / Invoices`인지 확인합니다.</li>
          <li>좌측 메뉴에 `Outbounds`, `Inventory`, `Billing`, `Dashboard`만 보이는지 확인합니다.</li>
          <li>상단 데이터 모드 배지(`LIVE`, `LIVE DEV`, `MOCK`, `FALLBACK DEV`)가 현재 확인하려는 환경과 맞는지 봅니다.</li>
          <li>목록이 비어 있으면 날짜, 월, 검색어 필터를 먼저 초기화하고 다시 조회합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">4. 출고 현황 확인</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>`Outbounds`에서 출고번호, 주문번호, 상태, 출고 예정일을 확인합니다.</li>
          <li>상세 화면의 `Items` 탭에서 요청수량, 피킹수량, 가용수량, 부족수량을 확인합니다.</li>
          <li>`Shortage Alerts`가 보이면 물류 운영자에게 재고 부족 또는 재할당 필요 여부를 문의합니다.</li>
          <li>`Boxes` 탭에서는 박스번호, 택배사, 송장번호, 아이템 수량을 확인합니다.</li>
          <li>`Timeline` 탭에서 출고 상태 변경 이력을 확인합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">5. 재고 확인</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>`Inventory`에서 상품명, 바코드, LOT, 창고, 위치 기준으로 재고를 검색합니다.</li>
          <li>`Available`은 현재 사용 가능한 재고, `Reserved`는 출고 대기 등으로 잡힌 예약수량입니다.</li>
          <li>`Allocatable`은 출고 가능 판단에 사용하는 수량입니다.</li>
          <li>입고 또는 출고 후 수량이 기대와 다르면 거래 이력에서 inbound/outbound 기록을 확인합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">6. 인보이스 확인</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>`Billing`에서 기간과 상태를 선택해 인보이스를 조회합니다.</li>
          <li>인보이스 번호를 눌러 상세 화면으로 들어갑니다.</li>
          <li>상세 화면에서 `Original THB`, `FX Rate`, `Subtotal`, `VAT`, `Total`을 확인합니다.</li>
          <li>품목별 `Qty`, `Unit KRW`, `Amount KRW` 합계가 총액과 맞는지 확인합니다.</li>
          <li>금액에 이견이 있으면 인보이스 번호와 품목명을 기준으로 운영 담당자에게 문의합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">7. 대시보드 확인</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>`Storage Trend`에서 기간별 보관량 추이를 확인합니다.</li>
          <li>`Storage Billing`에서 월별 보관요금 예상치를 확인합니다.</li>
          <li>`Capacity`에서 창고 적재율이 `ok`, `warn`, `critical` 중 어디에 해당하는지 확인합니다.</li>
          <li>공유가 필요하면 CSV 다운로드, 클립보드 복사, PNG 캡처 기능을 사용합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">8. 데이터가 안 보일 때</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>검색어, 날짜, 월 필터를 초기화하고 다시 조회합니다.</li>
          <li>다른 고객사 데이터는 보이지 않는 것이 정상입니다. 고객사 계정은 자기 회사 데이터로 자동 제한됩니다.</li>
          <li>출고/재고/인보이스가 모두 비어 있으면 운영 담당자에게 계정의 고객사 연결 상태를 확인 요청합니다.</li>
          <li>상단 배지가 `MOCK` 또는 `FALLBACK DEV`라면 실제 운영 데이터가 아닐 수 있습니다.</li>
        </ol>
      </div>
    </section>
  );
}

function OperatorGuidePage() {
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
          <li>상세 화면의 `Subtotal`, `VAT`, `Total`, 품목별 `Unit KRW`, `Amount KRW`는 `TRUNC100` 기준으로 표시됩니다.</li>
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

        <h3 className="mt-4 font-semibold text-slate-900">5-1. 한 번에 따라 하는 시뮬레이션</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>`apps/api`에서 `npm run seed:phase1-integrated`를 실행해 입고/출고/정산 검증 데이터를 준비합니다.</li>
          <li>`Inbounds`에서 현재 월 입고 오더를 열고 `Submit -&gt; Arrive -&gt; Receive` 순으로 처리합니다.</li>
          <li>`Inventory`에서 재고 증가를 확인한 뒤 `Outbounds`에서 `Allocate -&gt; Pack -&gt; Ship` 순으로 처리합니다.</li>
          <li>`Billing Events`에서 같은 고객과 월 기준 `PENDING` 이벤트를 확인하고, `Invoices`에서 `Generate -&gt; Issue -&gt; Mark Paid` 순으로 마무리합니다.</li>
          <li>`Dashboard`에서는 같은 고객/창고/월 조건으로 결과를 비교합니다.</li>
        </ol>

        <div className="mt-3 rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">통합 시드 기준 빠른 체크리스트</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>고객/창고: `C101`, `WH201`</li>
            <li>입고 오더: `INB-20260301-001` 수량 `120`, `INB-20260303-001` 수량 `80`</li>
            <li>출고 오더: `OUT-20260310-001` 수량 `70` shipped, `OUT-20260311-001` 수량 `30` packed</li>
            <li>재고 기대값: `available 130`, `reserved 30`</li>
            <li>인보이스 번호 형식: `INV-현재년월-C101-001`</li>
            <li>인보이스 기대금액: `4,900 + 3,500 + 1,200 = 9,600 KRW`, `FX 39.2500`</li>
          </ul>
        </div>

        <h3 className="mt-4 font-semibold text-slate-900">5-2. 시뮬레이션 중 꼭 보는 포인트</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>출고 상세의 `Reallocation Suggestions`는 다른 위치 재할당이 필요하다는 의미입니다.</li>
          <li>`Shortage Alerts`가 보이면 바로 출고 완료하지 말고 `Inventory`에서 실제 가용 재고를 다시 확인합니다.</li>
          <li>박스 버튼이 비활성화되어 있으면 현재 백엔드에서 Box API가 비활성화된 상태일 수 있습니다.</li>
          <li>`Storage Billing`의 SKU별 미리보기는 `warehouse`와 `client`를 함께 선택해야 열립니다.</li>
          <li>`Capacity`의 `critical / warn / ok`와 `capacity not set`는 각각 과적 위험과 기준정보 누락을 구분해서 봐야 합니다.</li>
        </ul>

        <h2 className="mt-6 text-base font-semibold text-slate-900">6. Dashboard와 설정에서 자주 쓰는 기능</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>`Storage Trend`, `Storage Billing`, `Capacity` 화면에서 CSV 다운로드, 클립보드 복사, PNG 캡처를 사용할 수 있습니다.</li>
          <li>대시보드의 `Generate Snapshots` 버튼은 빈 결과 화면에서만 보일 수 있고, 현재 배포/프로덕션 환경에서는 숨겨질 수 있습니다.</li>
          <li>`Storage Billing`은 필요 시 `rateCbm`, `ratePallet`을 직접 넣어 가정 계산을 다시 볼 수 있습니다.</li>
          <li>`Settings`에서는 공통 기준정보 외에 `Service Rates`, `Contract Rates`, `Storage Rates`, `Exchange Rates`를 관리합니다.</li>
          <li>`Billing Settings` 수정 권한은 관리자에게만 있습니다.</li>
        </ul>

        <h3 className="mt-4 font-semibold text-slate-900">6-1. 대시보드 실무 사용 순서</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>`Dashboard` 또는 `Storage Trend`에서 고객사, 창고, 기간을 먼저 맞춰 현재 재고 흐름과 보관 추이를 확인합니다.</li>
          <li>데이터가 비어 있으면 먼저 현재 환경이 로컬/개발인지 확인합니다. 프로덕션에서는 `Generate Snapshots` 버튼이 보이지 않을 수 있습니다.</li>
          <li>비프로덕션 환경에서 빈 결과 화면이 나오면 `Generate Snapshots`를 실행한 뒤 다시 조회합니다.</li>
          <li>`Storage Billing`에서는 같은 고객과 월 조건으로 보관요금 예상치가 정산 결과와 크게 어긋나지 않는지 비교합니다.</li>
          <li>SKU 단위 검증이 필요하면 `warehouse`와 `client`를 함께 선택해 하단 `SKU CBM Billing Preview`를 확인합니다.</li>
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
          <li>`Dashboard`에서 CSV 다운로드, 클립보드 복사, PNG 캡처를 확인하고, 비프로덕션 빈 화면일 때만 스냅샷 생성 버튼을 확인합니다.</li>
          <li>`client_viewer` 계정으로 다시 로그인해 `Inbounds`, `Settings`가 보이지 않는지 확인합니다.</li>
          <li>더 자세한 수동/자동 테스트 명령은 `docs/user-guide-ko.md`를 참고합니다.</li>
        </ol>

        <h2 className="mt-6 text-base font-semibold text-slate-900">10. 데이터가 안 보일 때(0건) 점검 순서</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>년도/월 필터를 조정해서 다시 조회합니다. (당월에 데이터가 없을 수 있습니다)</li>
          <li>기간이 너무 좁지 않은지 확인합니다. (예: 올해 1월 1일 ~ 오늘)</li>
          <li>`Client ID`가 잘못 입력되지 않았는지 확인합니다.</li>
          <li>샘플 데이터가 필요하면 `Create Sample Events`를 실행합니다.</li>
          <li>Dashboard가 비면 현재 환경이 비프로덕션인지 먼저 확인하고, 그때만 `Generate Snapshots`를 기대합니다.</li>
          <li>여전히 0건이면 API `/health/db`의 billing readiness를 확인합니다.</li>
        </ol>
      </div>
    </section>
  );
}
