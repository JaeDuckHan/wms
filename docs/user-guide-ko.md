# WMS 사용자 가이드 (기술명세 기반)

## 1. 문서 목적
- 본 문서는 웹 콘솔 메뉴별 기능을 운영 사용자 관점에서 설명하고, 실제 동작 규칙(입력/처리/결과/예외)을 함께 정의한다.
- 화면 사용법과 API/데이터 처리 기대값을 연결해 QA, 운영, 장애 대응 시 공통 기준으로 사용한다.

## 2. 공통 규칙
- 인증: `/login` 성공 시 토큰 쿠키(`kb3pl_token`)가 설정되어야 한다.
- 권한: 로그인 사용자 기준으로 API 접근이 제어된다.
- 검색/필터: 상단 검색 및 각 페이지 필터는 URL 쿼리와 동기화된다.
- 데이터 모드: 상단바 배지는 현재 연결 상태를 `LIVE`, `LIVE DEV`, `MOCK`, `FALLBACK DEV` 중 하나로 표시한다.
- 운영 모드: production 에서는 fallback/mock 자동 전환이 금지된다.
- 삭제 정책: 설정 메뉴 데이터는 soft delete 또는 API 정책에 따라 목록에서 제외될 수 있다.

## 3. 로그인 (`/login`)
### 목적
- 사용자 인증 후 콘솔 접근 세션을 생성한다.

### 사용 방법
1. 이메일, 비밀번호 입력
2. `Sign in` 클릭
3. 성공 시 요청된 `next` 경로 또는 기본 콘솔 화면으로 이동

### 처리 규칙
- 버튼은 `type="submit"`으로 폼 제출을 트리거한다.
- 토큰 쿠키는 HTTPS에서만 `Secure` 속성이 붙는다(로컬 HTTP 개발 환경 로그인 지원).
- 로그인 후 기본 진입 경로는 role 에 따라 달라질 수 있다.
  - 운영 계정: `/outbounds`
  - 고객 조회 계정(`client_viewer`): `/billing`

### 오류 대응
- 401/400: 계정 정보 재확인
- 네트워크 오류: API 서버(`:3100`) 및 프록시(`/api/proxy/*`) 상태 점검

## 4. 인바운드 (`/inbounds`)
### 목적
- 입고 오더 조회/상세 확인 및 상태 흐름 관리

### 주요 기능
- 입고 오더 목록 조회(검색/상태 필터)
- 상세 페이지 진입 후 상태/품목 정보 확인

### 입력/출력
- 입력: `q`, `status`
- 출력: 오더 번호, 상태, 고객, 창고, 생성/수정 시각 등

### 처리 규칙
- 인증 토큰 누락 시 로그인 화면으로 리다이렉트된다.
- 상세 진입 시 오더 번호(`inboundNo`) 기준 조회한다.

## 5. 아웃바운드 (`/outbounds`)
### 목적
- 출고 오더 운영(조회, 상세 확인, 박스 처리, 상태 전이)

### 주요 기능
- 목록 검색/상태 필터
- 상세 화면에서 상태 액션 실행
- 박스 추가/조회(백엔드 지원 시)

### 처리 규칙
- 상태 전이는 백엔드 검증 규칙을 따른다(예: 재고 부족 시 실패).
- `allocated`, `picking`, `packed` 상태에서는 예약재고가 반영된다.
- `shipped` 전환 시 예약 해제와 실재고 차감이 같이 적용된다.
- 박스 API 비지원 환경에서는 버튼 비활성/안내 메시지로 처리한다.

### 운영 체크
- 출고 완료 후 재고/트랜잭션 화면과 데이터 정합성 확인
- 상세 화면에서 `Reserved`, `Allocatable`, `Shortage` 표시가 기대값과 맞는지 확인

## 6. 재고 (`/inventory`)
### 목적
- 현재고와 트랜잭션 이력을 조회해 입출고 반영 결과를 검증

### 주요 기능
- `balances`: 상품/로트/창고 기준 현재고 조회
- `transactions`: 재고 변동 이력 조회

### 입력/출력
- 입력: 검색어, 트랜잭션 타입(`inbound_receive`, `outbound_ship`, `return_receive` 등)
- 출력: 수량, 위치, 변동 사유, 발생 시각
- 현재고 화면은 `Available`, `Reserved`, `Allocatable` 를 같이 보여준다.

### 처리 규칙
- 토큰 없으면 접근 차단
- API 응답 실패 시 화면 오류 상태를 명확히 표시
- `Allocatable = Available - Reserved` 기준으로 출고 가능 수량을 해석한다.

## 7. 정산 (`/billing`, `/billing/events`, `/billing/{id}`)
### 목적
- 정산 이벤트 집계, 인보이스 생성/발행/수납 상태 관리

### 7-1. 인보이스 목록
- 기능: 필터 조회, `Generate`, `Re-generate Draft`, 샘플 이벤트 생성
- 처리 규칙: 생성 시 월/고객 기준 집계 실행, 중복 생성은 상태/정책에 따라 제한

### 7-2. 인보이스 상세
- 기능: `Issue`, `Mark Paid`, `Export Invoice`, `Duplicate (Admin)` 등
- 처리 규칙: 상태 전이(`draft -> issued -> paid`)는 순서 제약을 따른다
- `Export Invoice` 는 메타 응답 확인 후 다운로드 URL로 실제 출력 파일을 연다.
- export 실행 이력은 감사로그로 조회할 수 있다.

### 7-3. Billing Events
- 기능: 이벤트 조회, 관리자용 pending 처리, CSV 내보내기
- 처리 규칙: 필터 조건(월, 고객, 상태, 서비스 코드)에 맞는 결과만 반환

## 8. 대시보드 (`/dashboard/*`)
### 목적
- 보관 지표 시각화 및 스냅샷 생성

### 하위 메뉴
- 개요: 대시보드 진입 허브
- Storage Trend: 기간별 보관량 추이
- Storage Billing: 월 보관비 미리보기
- Capacity: 창고 용량/리스크 모니터링

### API 계약
- 프론트는 `/api/dashboard/*` 프록시 경로만 사용한다.
- 백엔드는 `/api/dashboard/*` 엔드포인트만 공식 지원한다.

### 운영 체크
- 스냅샷 생성 후 동일 기간 조회 시 데이터 반영 여부 확인

## 9. 설정 (`/settings/*`)
### 목적
- 기준정보(고객/상품/창고/요율) CRUD

### 9-1. Clients / Products / Warehouses
- 기능: `New`, `Edit`, `Delete`, 활성/비활성 토글
- 입력 검증: 코드/이름/필수 필드 누락 시 저장 불가
- 처리 규칙: 저장 후 목록/카운트 즉시 갱신

### 9-2. Billing 설정
- 대상: Service Rates, Exchange Rates, Client Contract Rates
- 기능: 요율 생성/수정/삭제
- 처리 규칙: 잠금/사용중 데이터는 편집·삭제 제한 가능
- admin 만 진입 또는 수정 가능하며, 다른 role 은 제한 안내를 본다.

## 10. 고객 전용 화면 규칙
### 대상 role
- `client_viewer`

### 기본 동작
- 로그인 후 기본 진입 경로는 `/billing` 이다.
- 사이드바에는 고객 전용 메뉴만 노출된다.
  - `Dashboard`
  - `Outbounds`
  - `Inventory`
  - `Billing`

### 접근 제한
- `Inbounds`, `Settings` 는 메뉴에서 숨김 처리된다.
- 직접 URL 접근 시 제한 화면 또는 우회 처리된다.
- 서버 조회는 토큰의 `client_id` 기준으로 자기 업체 데이터만 반환한다.

### 테스트 포인트
- 다른 `client_id` 조건을 직접 넣어도 자기 업체 데이터만 보여야 한다.
- Billing 에서는 자기 업체 인보이스만 보여야 한다.
- Inventory, Outbounds, Dashboard 도 같은 기준으로 잘려야 한다.

## 11. 기능 테스트 빠른 시작
### 목적
- 운영자 또는 QA 담당자가 별도 설명 없이 기본 기능을 점검할 수 있도록 최소 절차를 제공한다.

### 사전 준비
1. 웹(`3000`)과 API(`3100`)가 실행 중이어야 한다.
2. DB seed 와 runtime patch 가 반영돼 있어야 한다.
3. 운영 검증이면 `NEXT_PUBLIC_USE_MOCK=false` 여야 한다.
4. 상단바 데이터 모드 배지가 기대값과 일치해야 한다.

### 기본 테스트 계정
- admin: `admin@example.com / x`
- manager: `manager101@example.com / x`
- warehouse: `warehouse201@example.com / x`
- client viewer: `viewer101@example.com / x`

### 공통 확인 순서
1. 로그인
2. 상단바 데이터 모드 배지 확인
3. 메뉴 노출 범위 확인
4. 목록 조회
5. 상세 진입
6. 권한 있는 액션 실행
7. 결과가 목록, 상세, 재고, 정산에 반영되는지 확인

### 권장 기능 테스트 시나리오
1. `admin` 으로 로그인 후 Billing 에서 sample event 생성
2. Billing Events 에서 `SAMPLE-*` 데이터 생성 확인
3. Billing Invoices 에서 인보이스 생성 후 상세 진입
4. `Issue -> Export Invoice -> Mark Paid` 순서 확인
5. Inventory 에서 `Available / Reserved / Allocatable` 표시 확인
6. Outbounds 상세에서 `Shortage`, `Allocatable`, 추천 배정 표시 확인
7. `client_viewer` 로 재로그인 후 고객 전용 메뉴와 자기 업체 데이터만 보이는지 확인

### 자동화 스크립트
- API 기반 시나리오 스크립트:
  - [run_outbound_detail_flow.ps1](D:\codex\wms\apps\api\scripts\run_outbound_detail_flow.ps1)
  - [run_invoice_reuse_flow.ps1](D:\codex\wms\apps\api\scripts\run_invoice_reuse_flow.ps1)
  - [run_settlement_invoice_flow.ps1](D:\codex\wms\apps\api\scripts\run_settlement_invoice_flow.ps1)
  - [run_billing_production_flow.ps1](D:\codex\wms\apps\api\scripts\run_billing_production_flow.ps1)

### 상세 체크리스트 문서
- role/권한별 체크: [role-test-checklist-ko.md](D:\codex\wms\docs\role-test-checklist-ko.md)
- Billing UX 중심 체크: [billing-ux-flow-checklist.md](D:\codex\wms\docs\billing-ux-flow-checklist.md)

## 12. 장애 대응 체크리스트
1. 로그인 불가: 쿠키 설정 여부, `/api/proxy/auth/login` 응답 코드 확인
2. 메뉴 진입 불가: 토큰 만료/누락, 권한 오류(401/403) 확인
3. 대시보드 공백: `/api/dashboard/*` 응답 및 파라미터 확인
4. 정산 실패: 이벤트 데이터 유무, 정산 배치 상태, 인보이스 상태 전이 확인
5. 인보이스 export 실패: `/billing/invoices/:id/export-pdf` 와 `/billing/invoices/:id/export-logs` 확인
6. 설정 저장 실패: 필수값/중복키/참조 무결성 오류 메시지 확인

## 13. 검증 명령(권장)
- 웹 정적 검증: `cd apps/web && npm run web:check`
- API 헬스 스모크: `cd apps/api && npm run test:e2e:health-smoke`
- 웹 스모크: `npm run start -- -p 3000` 후 `GET /login` 상태코드 200 확인
