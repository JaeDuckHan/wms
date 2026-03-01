# Phase 1 Work Plan: 입고/출고/재고 조회 정합성 + 로그 적재 보강

## Context
현재 프로젝트는 입고 데이터(일자/수량)와 일부 로그 구조는 존재하지만, 입고/출고/재고 간 로그 적재 규칙과 조회 정합성 검증이 일관되지 않습니다.  
또한 이번 1차 범위는 **로그/정합성 보강**이며, **업체별 접근제어(tenant/client_id 강제)는 2차로 분리**합니다.

근거 파일(현행):
- 입고/출고 라우트: `apps/api/src/routes/inboundOrders.js`, `inboundItems.js`, `outboundOrders.js`, `outboundItems.js`
- 재고/트랜잭션: `apps/api/src/routes/stocks.js`, `schema_v1.sql`
- 웹 조회: `apps/web/features/inbound/api.ts`, `apps/web/features/outbound/api.ts`, `apps/web/features/inventory/api.ts`
- 화면: `apps/web/app/(console)/inbounds/page.tsx`, `.../outbounds/page.tsx`, `.../inventory/page.tsx`

## Work Objectives
1. 입고/출고/재고의 수량·일자·이력 조회가 DB/API/UI에서 동일하게 맞는다.
2. 입고/출고 변경 이벤트에서 로그 누락 없이 적재된다.
3. 샘플 데이터 초기화/재적재 기준을 고정해 재현 가능한 검증 루틴을 만든다.

## Guardrails
### Must Have
- 1차 범위는 로그 적재/조회 정합성에 한정
- DB 초기화 + 샘플 재적재 절차를 문서화/스크립트화
- 검증 시 웹 mock/fallback 비활성 경로 포함
- API/SQL/UI 3단 검증 결과를 남길 것

### Must NOT Have
- tenant/client_id 강제 접근제어 변경(2차)
- 대규모 아키텍처 재설계
- 범위 외 도메인(정산 권한/조직권한)까지 확장

## Task Flow (5 Steps)

### Step 1) 정합성/로그 기준 동결
**TODO**
- 입고/출고/재고 정합성 기준식과 이벤트 목록(생성/수정/삭제/상태변경)을 계획 문서에 확정
- 1차 범위/2차 제외(tenant) 경계를 명시
- soft delete 시 조회/로그 기대 동작을 명문화

**Acceptance Criteria**
- 기준 문서에 아래가 명시됨:
  - 정합성 기준식(재고 잔량 vs 트랜잭션 합계)
  - 로그 적재 대상 이벤트 목록
  - 2차 제외 항목(tenant 강제)
- 팀이 동일 기준으로 검증 가능한 체크리스트 생성

---

### Step 2) DB 초기화 + 샘플 재적재 베이스라인 구축
**TODO**
- `schema_v1.sql`, `seed_testpack_base.sql` 기반 초기화/재적재 표준 절차 작성
- 검증용 기준 SQL 세트(누락로그/고아데이터/중복잔고 탐지) 작성
- 재적재 후 기준 상태 스냅샷 저장

**Acceptance Criteria**
- 한 번의 절차로 DB 초기화 및 샘플 적재가 재현됨
- 기준 SQL 실행 시 baseline 결과가 기록됨
- 이후 테스트는 동일 baseline에서 반복 가능

---

### Step 3) 백엔드 로그 적재 보강 (입고/출고/재고)
**TODO**
- 입고/출고 item C/U/D + 상태변경 + 삭제 경로에서 로그 누락 포인트 보강
- `stock_transactions`와 주문 로그(`.../logs`) 간 참조 일관성 보장
- 실패/예외 경로에서 부분 반영(잔고만 반영, 로그 미기록) 방지

**대상 파일(우선)**
- `apps/api/src/routes/inboundOrders.js`
- `apps/api/src/routes/inboundItems.js`
- `apps/api/src/routes/outboundOrders.js`
- `apps/api/src/routes/outboundItems.js`
- `apps/api/src/routes/stocks.js`

**Acceptance Criteria**
- 입고/출고 API 시나리오별로 로그 누락 0건
- 재고 트랜잭션의 ref/수량이 주문 변경 이력과 일치
- 오류 시 롤백/실패 응답이 일관되어 부분 반영 없음

---

### Step 4) API/문서/화면 조회 정합성 맞춤
**TODO**
- API 응답 필드(일자/수량/로그 타임라인)와 UI 표시를 일치화
- `/inbounds`, `/outbounds`, `/inventory` 화면에서 mock OFF 검증 경로 확보
- 필요한 OpenAPI/README 갱신(로그 endpoint/검증 절차)

**대상 파일(우선)**
- `apps/web/features/inbound/api.ts`
- `apps/web/features/outbound/api.ts`
- `apps/web/features/inventory/api.ts`
- `apps/web/app/(console)/inbounds/page.tsx`
- `apps/web/app/(console)/outbounds/page.tsx`
- `apps/web/app/(console)/inventory/page.tsx`
- `apps/api/src/openapi.json`, `apps/api/README.md`

**Acceptance Criteria**
- mock OFF 상태에서 DB/API/UI 값 불일치 0건
- 로그/트랜잭션 타임라인이 화면에서 누락 없이 조회됨
- 문서와 실제 endpoint 동작 불일치 이슈 해소

---

### Step 5) 회귀 검증 및 인수 리포트
**TODO**
- API 테스트(정상/예외), SQL 검증, 화면 점검을 한 번의 인수 루틴으로 실행
- 결과를 체크리스트 형태로 기록(통과/실패/재현방법)
- 2차(tenant 강제)로 넘길 잔여 이슈 분리

**Acceptance Criteria**
- 핵심 시나리오(입고/출고 C/U/D, 재고 조회, 로그 조회) 전부 통과
- 누락로그/고아데이터/중복잔고 탐지 쿼리 결과가 허용 기준 충족
- 2차 이관 이슈 목록이 명확히 분리 기록됨

## Success Criteria
- 1차 범위 내에서 로그 누락 및 조회 불일치가 재현되지 않는다.
- 샘플 DB 초기화→재적재→검증 루틴이 반복 가능하다.
- tenant 강제 변경 없이도 입고/출고/재고의 운영 가시성이 확보된다.

## Out of Scope (Phase 2)
- 업체별 접근제어 강제(`client_id` 스코프 미들웨어/쿼리 강제)
- 역할별 데이터 격리 정책 개편

