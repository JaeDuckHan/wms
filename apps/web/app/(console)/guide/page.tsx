import { PageHeader } from "@/components/ui/PageHeader";

export default function GuidePage() {
  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "설정" }, { label: "사용 가이드" }]}
        title="사용 가이드"
        subtitle="이 페이지에서 사용 흐름과 전체 QA 체크리스트를 확인할 수 있습니다."
      />

      <div className="rounded-xl border bg-white p-6 text-sm text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">1. 메뉴</h2>
        <p className="mt-2">
          입고, 출고, 재고, 정산, 설정 메뉴에서 핵심 기능을 테스트할 수 있습니다.
        </p>

        <h2 className="mt-6 text-base font-semibold text-slate-900">2. 설정 CRUD</h2>
        <p className="mt-2">
          거래처, 상품, 창고에서 생성/수정/삭제를 수행하고 카운트 배지가 정상 반영되는지 확인하세요.
        </p>

        <h2 className="mt-6 text-base font-semibold text-slate-900">3. 정산</h2>
        <p className="mt-2">
          청구서 생성, 발행, 수납 처리 흐름과 청구서 상세 페이지를 점검하세요.
        </p>

        <h2 className="mt-6 text-base font-semibold text-slate-900">4. 전체 QA 체크리스트</h2>
        <p className="mt-2">출시 전 CRUD 체크리스트 (메뉴별 샘플 20건 기준)</p>
        <p className="mt-1 text-xs text-slate-500">
          외부 문서 없이 이 페이지에서 전체 체크리스트를 확인할 수 있습니다.
        </p>

        <h3 className="mt-4 font-semibold text-slate-900">대상 범위</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>입고</li>
          <li>출고</li>
          <li>재고 &gt; 잔액</li>
          <li>재고 &gt; 거래내역</li>
          <li>설정 &gt; 거래처</li>
          <li>설정 &gt; 상품</li>
          <li>설정 &gt; 창고</li>
        </ul>

        <h3 className="mt-4 font-semibold text-slate-900">사전 점검</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>유효한 계정으로 로그인합니다.</li>
          <li>각 메뉴를 열어 검색 필터 없이 최소 20행이 보이는지 확인합니다.</li>
          <li>필터 배지/카운터가 실제 행 개수와 일치하는지 확인합니다.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">입고</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>목록을 열고 20행이 노출되는지 확인합니다.</li>
          <li>한 건의 상세를 열어 개요/품목/타임라인이 정상 렌더링되는지 확인합니다.</li>
          <li>상태 액션 1건을 수행하고 목록/상세 상태가 동기화되는지 확인합니다.</li>
          <li>입고번호와 거래처명으로 검색해 결과가 정확히 필터링되는지 확인합니다.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">출고</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>목록을 열고 20행이 노출되는지 확인합니다.</li>
          <li>한 건의 상세를 열어 개요/품목/박스/타임라인이 정상 렌더링되는지 확인합니다.</li>
          <li>박스 1건을 추가하고 박스 목록 개수가 증가하는지 확인합니다.</li>
          <li>상태 액션 1건을 수행하고 목록/상세 상태가 동기화되는지 확인합니다.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">재고</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>잔액 탭을 열고 20행이 노출되는지 확인합니다.</li>
          <li>거래내역 탭을 열고 20행이 노출되는지 확인합니다.</li>
          <li>
            txn_type 필터(inbound_receive, outbound_ship, return_receive)를 적용해 행 구성이
            올바르게 변경되는지 확인합니다.
          </li>
          <li>상품/거래처 키워드로 검색해 필터 결과가 정확한지 확인합니다.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">설정 &gt; 거래처</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>초기 목록에 샘플 20건이 포함되어 있는지 확인합니다.</li>
          <li>거래처 1건을 생성하고 행 개수가 +1 되는지 확인합니다.</li>
          <li>전체/활성/비활성/필터 카운터가 정확히 갱신되는지 확인합니다.</li>
          <li>생성한 행을 수정하고 변경값이 유지되는지 확인합니다.</li>
          <li>해당 행을 삭제하고 목록에서 제거되는지 확인합니다.</li>
          <li>카운터가 이전 값으로 복구되는지 확인합니다.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">설정 &gt; 상품</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>초기 목록에 샘플 20건이 포함되어 있는지 확인합니다.</li>
          <li>상품 1건을 생성하고 행 개수/카운터를 확인합니다.</li>
          <li>상품명/상태를 수정하고 변경값이 유지되는지 확인합니다.</li>
          <li>수정한 행을 삭제하고 카운터가 정상 복구되는지 확인합니다.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">설정 &gt; 창고</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>초기 목록에 샘플 20건이 포함되어 있는지 확인합니다.</li>
          <li>창고 1건을 생성하고 행 개수/카운터를 확인합니다.</li>
          <li>창고명/상태를 수정하고 변경값이 유지되는지 확인합니다.</li>
          <li>수정한 행을 삭제하고 카운터가 정상 복구되는지 확인합니다.</li>
        </ol>

        <h3 className="mt-4 font-semibold text-slate-900">회귀 점검 포인트</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>사용자 조작 전 어떤 페이지도 비정상 빈 화면을 보여주면 안 됩니다.</li>
          <li>생성/수정/삭제/토글 이후 목록과 카운터는 반드시 동기화되어야 합니다.</li>
          <li>검색 + 상태 필터 + 정렬 조합에서도 카운터 불일치가 발생하면 안 됩니다.</li>
          <li>
            브라우저 새로고침 후 API/mock 상태 유지 동작이 환경 기대값과 일치하는지 확인합니다.
          </li>
        </ol>
      </div>
    </section>
  );
}
