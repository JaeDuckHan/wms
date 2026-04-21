# WMS 사용자 가이드

## 1. 문서 목적

- 이 문서는 WMS 운영자, 관리자, QA가 실제 화면 기준으로 기능을 빠르게 이해하고 검증할 수 있도록 작성한 사용자 가이드입니다.
- 웹 화면(`/guide`)에 보이는 요약 가이드보다 더 많은 기능, 권한 차이, 테스트 방법을 포함합니다.
- 기준 범위는 현재 저장소의 `apps/web` 화면과 `apps/api` 라우트에 실제 구현된 기능입니다.

## 2. 시작 전 확인

### 접속 주소

- 웹: 환경별 배포 URL 또는 로컬 `http://localhost:3000`
- API Swagger: `http://localhost:3100/docs`
- API 상태 확인:
  - `GET /health`
  - `GET /health/db`

### 로그인 및 권한

- 로그인 화면: `/login`
- 로그인 성공 시 역할별 기본 진입 경로:
  - `admin`, `manager`, `warehouse`: `/outbounds`
  - `client_viewer`: `/billing`

### 기본 계정 예시

- `admin@example.com / x`
- `manager101@example.com / x`
- `warehouse201@example.com / x`
- `viewer101@example.com / x`
- 추가 데모 관리자: `ops.admin@amorepacific-partner.co.kr / 1234`

### 데이터 준비

- 최소 마스터 샘플: [seed_master_min.sql](D:/codex/wms/apps/api/sql/seed_master_min.sql)
- 통합 테스트팩 시드: [seed_phase1_integrated.js](D:/codex/wms/apps/api/scripts/seed_phase1_integrated.js)
- 현실형 대량 샘플: [seed_sample_realistic_10x.sql](D:/codex/wms/apps/api/sql/seed/seed_sample_realistic_10x.sql)

## 3. 메뉴 구조

- `Inbounds`: 입고 오더 목록, 상세, 상태 변경, 로그 조회
- `Outbounds`: 출고 오더 목록, 상세, 상태 변경, 박스 관리, 할당 제안, 로그 조회
- `Inventory`: 현재고, 예약수량, 출고 가능수량, 재고 트랜잭션 조회
- `Billing Events`: 청구 대상 이벤트 조회, CSV 내보내기, 관리자용 Pending 복원
- `Invoices`: 인보이스 생성, 초안 재생성, 샘플 이벤트 생성/정리, 발행, 수납 완료
- `Dashboard`: 스토리지 개요, 보관 추이, 보관 요금 미리보기, 적재율
- `Settings`: 고객사, 상품, 창고, 서비스 요율, 계약 요율, 보관 요율, 환율 관리
- `Guide`: 화면 사용 순서와 문제 해결 요약

## 4. 권한 요약

### 공통

- 모든 콘솔 화면은 로그인 필요
- `GET` 조회는 인증 사용자 공통 허용
- `POST/PUT/DELETE`는 기본적으로 `admin`, `manager`, `warehouse` 허용

### 역할별 차이

- `admin`
  - 모든 조회/쓰기 가능
  - Billing Settings 관리 가능
  - Billing Events의 `Mark as Pending (Admin)` 가능
  - 인보이스 상세의 `Duplicate (Admin)` 가능
- `manager`
  - 일반 쓰기 가능
  - Billing Settings는 조회만 가능, 수정 불가
  - `Duplicate (Admin)` 불가
- `warehouse`
  - 일반 쓰기 가능
  - Billing Settings는 조회만 가능, 수정 불가
- `client_viewer`
  - 읽기 전용
  - 기본 메뉴는 `Dashboard`, `Outbounds`, `Inventory`, `Billing`
  - `Inbounds`, `Settings` 비노출
  - 고객사 스코프로 자기 데이터만 조회

## 5. 실무 흐름 예시

### 5.1 기존 업체의 상품 추가

1. `Settings > Clients`에서 고객사 코드와 회사명을 먼저 확인합니다.
2. `Settings > Products`에서 상품을 추가합니다.
3. 상품 추가 창의 고객사 입력칸은 코드만 외우지 않아도 되도록, 입력한 코드에 매칭되는 회사명을 바로 같이 보여 줍니다.
4. 고객사가 목록에 없으면 상품 등록 전에 먼저 `Clients`에서 고객사를 등록해야 합니다.

### 5.2 기존 상품의 입고 처리

1. 고객사와 상품 마스터가 준비되어 있는지 먼저 확인합니다.
2. 입고 오더가 생성되어 있으면 `Inbounds` 목록에서 해당 입고번호를 열어 상세를 확인합니다.
3. 상태는 일반적으로 `draft -> submitted -> arrived -> received` 순서로 진행합니다.
4. 입고 완료 후에는 `Inventory`에서 수량 증가와 로트/위치 반영을 함께 확인합니다.

주의:
- 현재 웹 콘솔은 입고 오더의 신규 작성보다 목록 조회, 상세 확인, 상태 처리 중심입니다.
- 신규 입고 오더 자체를 어디서 생성하는지는 운영 환경의 API 연계 또는 별도 백오피스 흐름을 함께 확인해야 합니다.

### 5.3 입고 후 출고 처리로 이어가기

1. 입고 완료 후 `Inventory`에서 출고 가능한 재고가 잡혔는지 확인합니다.
2. `Outbounds`에서 출고 오더를 열고 `Allocate -> Pack -> Ship` 순으로 처리합니다.
3. 출고 상세에서 `Available`, `Reserved`, `Allocatable`, `Shortage`를 같이 보고 부족 여부를 판단합니다.
4. 출고 완료 후에는 재고 차감과 정산 이벤트 반영을 같이 점검합니다.

### 5.4 정산과 대시보드 사용 흐름

1. `Billing Events`에서 청구하려는 연도/월/고객을 먼저 선택합니다.
2. `PENDING` 이벤트가 이번 달 청구 대상과 맞는지 확인합니다.
3. 잘못 `INVOICED`로 묶인 이벤트가 있으면 관리자 권한으로 `Mark as Pending (Admin)`을 사용해 되돌립니다.
4. `Invoices`에서 같은 고객과 기준일로 조회한 뒤 `Generate` 또는 `Re-generate Draft`를 실행합니다.
5. 생성된 초안에서 품목별 금액, KRW 총액, 환율, 원화 환산 전 THB 금액을 검토합니다.
6. 이상이 없으면 `Issue`로 발행하고, 실제 수금까지 끝났으면 `Mark Paid`로 마감합니다.
7. 전달용 파일이 필요하면 `Export Invoice`를 사용합니다.
8. 운영 검증은 `Dashboard`의 `Storage Trend`, `Storage Billing`, `Capacity` 화면으로 이어서 확인합니다.
9. 대시보드 데이터가 비어 있으면 먼저 현재 환경이 로컬/개발인지 확인합니다. `Generate Snapshots` 버튼은 비프로덕션 환경에서만 노출될 수 있으므로, 운영/배포 환경에서는 시드 재적용 또는 백엔드 스냅샷 생성 여부를 먼저 점검합니다.

## 6. 화면별 사용 방법

### 5.1 로그인 `/login`

- 이메일과 비밀번호를 입력하고 로그인합니다.
- 로그인 실패 시 계정 정보 또는 API 연결을 먼저 확인합니다.
- 로그인 후 상단 데이터 모드 배지(`LIVE`, `LIVE DEV`, `MOCK`, `FALLBACK DEV`)를 확인합니다.

### 5.2 Inbounds `/inbounds`

#### 주요 기능

- 입고 오더 목록 조회
- 검색어/상태 필터
- 입고 상세 조회
- 도착, 입고 완료 등 상태 반영
- 입고 품목 확인
- 입고 로그 조회 API 지원

#### 운영 체크 포인트

- 입고번호, 고객사, 창고, 상태가 맞는지 확인
- 입고 완료 후 재고 화면에 수량이 반영되는지 확인
- 상세 화면의 품목/로트/위치가 예상과 맞는지 확인

### 5.3 Outbounds `/outbounds`

#### 주요 기능

- 출고 오더 목록 조회
- 검색어/상태 필터
- 출고 상세 조회
- 상태 전이(`confirmed`, `allocated`, `picking`, `packed`, `shipped` 등)
- 박스 추가/수정/삭제
- 할당 제안 조회
- 출고 로그 조회 API 지원

#### 운영 체크 포인트

- 상세 화면의 `Available`, `Reserved`, `Allocatable`, `Shortage`가 기대와 맞는지 확인
- `shipped` 처리 후 재고 차감과 정산 이벤트 반영을 함께 확인
- 박스 정보 수정 후 상세 화면과 API 결과가 일치하는지 확인
- `Reallocation Suggestions`가 보이면 현재 위치 외 다른 로트/위치로 재할당이 필요하다는 의미로 해석
- `Shortage Alerts`가 보이면 출고 가능 수량 부족 상태이므로 즉시 출고 완료 처리 전에 재고를 먼저 확인
- 박스 버튼이 비활성화되어 있으면 현재 백엔드에서 Box API가 비활성화된 상태일 수 있으므로, 박스 등록 불가를 장애로 오인하지 않도록 확인

### 5.4 Inventory `/inventory`

#### 주요 기능

- 재고 잔량(`stock-balances`) 조회
- 재고 트랜잭션(`stock-transactions`) 조회
- 검색/유형별 필터
- `Available`, `Reserved`, `Allocatable` 표시

#### 운영 체크 포인트

- 입고 완료 후 증가, 출고 완료 후 감소가 반영되는지 확인
- 동일 상품의 로트/창고/위치별 분리가 맞는지 확인
- 출고 부족 시 `Allocatable`과 `Shortage` 계산이 맞는지 확인

### 6.5 Billing Events `/billing/events`

#### 주요 기능

- 년/월/고객/상태/서비스코드 기준 조회
- `PENDING`, `INVOICED` 상태 확인
- CSV 내보내기
- 관리자용 `Mark as Pending (Admin)`
- 고객 입력 시 고객사 코드와 회사명을 함께 확인 가능

#### 운영 체크 포인트

- 특정 월만 보려면 년도와 월을 같이 선택
- 연간 흐름을 보려면 년도만 선택
- `PENDING` 이벤트 수량과 고객/서비스코드 구성이 예상과 맞는지 먼저 확인
- `INVOICED` 이벤트는 이미 인보이스에 묶인 건인지 확인
- 잘못 묶인 이벤트만 관리자 권한으로 Pending 복원

### 6.6 Invoices `/billing`, `/billing/:id`

#### 주요 기능

- 기간 + 고객 기준 인보이스 목록 조회
- `Generate`
- `Re-generate Draft`
- `Create Sample Events`
- `Sample Data Cleanup`
- 상세 화면 조회
- `Issue`
- `Mark Paid`
- `Export Invoice`
- `Duplicate (Admin)`
- Export 로그 조회 API 지원
- `Client ID` 입력 시 현재 선택된 고객의 코드와 회사명을 같이 확인 가능

#### 상태 흐름

- `draft -> issued -> paid`

#### 운영 체크 포인트

- 종료일은 인보이스 기준일과 청구월 계산 기준으로도 사용
- `Generate` 전에 같은 고객의 Billing Events가 먼저 정리됐는지 확인
- KRW 합계, 원화 환산 전 THB, 환율 스냅샷을 함께 확인
- 인보이스 상세의 `Subtotal`, `VAT`, `Total`, 품목별 `Unit KRW`, `Amount KRW`는 `TRUNC100` 기준으로 표시되므로 QA 시 절사 규칙까지 같이 확인
- 발행 후 `Issue` 버튼이 사라지고 `Mark Paid`로 바뀌는지 확인
- 상세 화면의 품목별 금액 합계가 총액과 일치하는지 확인

### 5.7 Dashboard `/dashboard/*`

#### 하위 화면

- `/dashboard`: 개요
- `/dashboard/storage-trend`: 보관 추이
- `/dashboard/storage-billing`: 보관 요금 미리보기
- `/dashboard/capacity`: 적재율

#### 주요 기능

- 날짜/기간/창고/고객 필터
- CSV 다운로드
- 클립보드 복사
- PNG 캡처
- 스냅샷 부족 경고 표시
- 빈 결과 화면에서 최근 스냅샷 생성 버튼 노출 가능(비프로덕션 환경 전용)

#### 운영 체크 포인트

- 스냅샷이 없으면 먼저 현재 환경이 비프로덕션인지 확인
- 비프로덕션이면 빈 결과 화면의 `Generate Snapshots`로 최근 스냅샷 생성
- 프로덕션이면 버튼이 보이지 않을 수 있으므로 시드/백엔드 스냅샷 생성 상태를 먼저 확인
- 같은 조건으로 재조회해 수치 일관성 확인
- 보관 요금 화면에서 고객/창고/월 필터 변경 시 합계가 바뀌는지 확인
- `Storage Billing`의 SKU별 미리보기는 `warehouse`와 `client`를 함께 선택해야 노출되므로, 상세 검증 시 두 필터를 동시에 지정
- `rateCbm`, `ratePallet` 수동 입력값이 있으면 미리보기 계산에 즉시 반영되므로, 요율 실험 중이면 입력값을 먼저 확인
- 정산 검토 시 `Storage Billing` 수치와 실제 인보이스 금액이 크게 어긋나지 않는지 비교
- `Capacity`에서는 `critical / warn / ok` 상태와 `capacity not set` 메시지를 같이 해석해 과적 여부와 기준정보 누락을 구분
- 보고용 자료는 CSV, 클립보드, PNG 기능으로 추출

### 6.8 Settings `/settings/*`

#### 공통 기준정보

- `Clients`
- `Products`
- `Warehouses`

#### 정산 설정

- `Service Rates`
- `Contract Rates`
- `Storage Rates`
- `Exchange Rates`

#### 운영 체크 포인트

- 코드/이름/필수값 검증 메시지가 정확한지 확인
- 저장 후 목록 즉시 갱신 여부 확인
- 삭제는 목록 제외 기준으로 동작하는지 확인
- Billing Settings는 admin만 수정 가능한지 확인
- Products에서 고객사 선택 시 코드만이 아니라 회사명도 같이 확인되는지 확인

## 7. 샘플 데이터 사용 방법

### 최소 데모 구동

1. 스키마 적용: [schema_v1.sql](D:/codex/wms/apps/api/sql/schema_v1.sql)
2. 최소 마스터 적용: [seed_master_min.sql](D:/codex/wms/apps/api/sql/seed_master_min.sql)
3. API 실행 후 `/health/db` 확인

### 통합 시나리오 준비

1. `apps/api`에서 `npm run seed:phase1-integrated`
2. 입고/출고/정산/인보이스 검증 데이터를 한 번에 준비

### 입고/출고/정산/대시보드 시뮬레이션 순서

이 절차는 "이미 생성된 오더를 콘솔에서 처리하는 흐름"을 검증하는 용도입니다. 현재 웹 콘솔은 입고/출고 오더 신규 생성 화면이 아니라, 시드 또는 외부 연계로 준비된 오더를 조회하고 상태 처리하는 방식입니다.

1. `apps/api`에서 `npm run seed:phase1-integrated`를 실행합니다.
2. 관리자 계정으로 로그인한 뒤 `Inbounds`에서 현재 월 입고 데이터가 보이는지 확인합니다.
3. 입고 상세 화면에서 상태를 `Submit -> Arrive -> Receive` 순으로 진행하고, `Items`와 `Timeline` 탭을 같이 확인합니다.
4. `Inventory`로 이동해 방금 처리한 상품의 수량 증가와 `stock-transactions`의 inbound 기록을 확인합니다.
5. `Outbounds`에서 현재 월 출고 오더를 열고 `Allocate -> Pack -> Ship` 순으로 진행합니다.
6. 출고 상세의 `Items` 탭에서 `Available`, `Reserved`, `Allocatable`, `Shortage`를 확인하고, 필요 시 `Boxes` 탭에서 박스 정보를 추가합니다.
7. `Inventory`에서 수량 감소가 반영됐는지 확인하고, `Billing Events`에서 같은 고객/월 기준 `PENDING` 이벤트가 생겼는지 확인합니다.
8. `Invoices`에서 같은 고객과 기준일로 조회한 뒤 `Generate -> Issue -> Mark Paid` 순으로 처리합니다.
9. `Dashboard > Storage Trend`, `Storage Billing`, `Capacity`에서 같은 고객/월/창고 조건으로 수치가 비정상적으로 어긋나지 않는지 비교합니다.
10. 대시보드가 비어 있으면 로컬/개발 환경에서만 `Generate Snapshots` 버튼을 기대합니다. 배포 환경이라면 버튼 대신 시드 상태와 백엔드 스냅샷 생성 여부를 점검합니다.

### 시뮬레이션 예시 A: 정상 입고 -> 출고 -> 정산

1. `seed:phase1-integrated` 적용 후 현재 월 입고 1건을 열어 `Submit -> Arrive -> Receive`까지 처리합니다.
2. `Inventory`에서 해당 SKU의 수량 증가와 inbound 트랜잭션을 확인합니다.
3. 같은 고객의 출고 오더를 열어 `Allocate -> Pack -> Ship`을 진행합니다.
4. `Billing Events`에서 같은 월 `PENDING` 이벤트가 생성됐는지 확인합니다.
5. `Invoices`에서 같은 고객으로 `Generate` 후, 상세 화면에서 `Original THB`, `FX`, `Subtotal/VAT/Total (TRUNC100)`를 점검합니다.
6. 이상이 없으면 `Issue -> Mark Paid`까지 진행하고, `Dashboard`의 `Storage Billing`과 큰 차이가 없는지 비교합니다.

체크리스트:
- 고객사: `C101`
- 창고: `WH201`
- 상품 기준: `barcode_full=FULL401`, `lot=LOT-501`, `location=LOC-301`
- 입고 오더:
  - `INB-20260301-001` 수량 `120`, 상태 `received`
  - `INB-20260303-001` 수량 `80`, 상태 `received`
- 출고 오더:
  - `OUT-20260310-001` 수량 `70`, 상태 `shipped`
  - `OUT-20260311-001` 수량 `30`, 상태 `packed`
- 재고 기대값:
  - `available_qty = 130`
  - `reserved_qty = 30`
  - 계산 근거: `120 + 80 - 70 = 130`, packed 오더 `30` 예약
- 정산 배치:
  - `settlement_batch_id = 700501`
  - 상태 `closed`
- 인보이스:
  - 번호 형식 `INV-현재년월-C101-001`
  - 상태 `issued`
  - `FX = 39.2500`
  - `Subtotal = 9,600 KRW`
  - `VAT = 0 KRW`
  - `Total = 9,600 KRW`
- 인보이스 라인 기대값:
  - `SV_OUTBOUND_BOX` `7 x 700 = 4,900 KRW`
  - `SV_OUTBOUND_ORDER` `1 x 3,500 = 3,500 KRW`
  - `SV_MANUAL_EXPENSE` `1 x 1,200 = 1,200 KRW`
- Billing Events 기대값:
  - `700421`, `700422`, `700423`
  - 상태 모두 `INVOICED`

### 시뮬레이션 예시 B: 출고 부족/재할당 확인

1. 출고 상세의 `Items` 탭에서 `Allocatable Qty`가 `Requested Qty`보다 작은 항목이 있는지 봅니다.
2. `Reallocation Suggestions`가 보이면 현재 위치 외 다른 로트/위치의 제안 수량을 함께 검토합니다.
3. `Shortage Alerts`가 보이면 즉시 `Ship`하지 말고 `Inventory`에서 실제 가용 재고와 위치별 잔량을 다시 확인합니다.
4. 박스 등록 버튼이 비활성화되어 있으면 Box API 미지원 상태일 수 있으므로, 박스 기능 자체가 막힌 환경인지 먼저 구분합니다.

체크리스트:
- 정상 통합 시드 직후에는 `OUT-20260310-001`은 이미 `shipped`이므로 부족 경고 없이 종료 상태로 보이는 것이 정상
- `OUT-20260311-001`은 `packed` 상태이며 예약 수량 `30`이 반영되어 있어야 함
- `Items` 탭에서 최소 확인 항목:
  - `Requested Qty`
  - `Available`
  - `Reserved`
  - `Allocatable`
  - `Shortage`
- 박스 기대값:
  - `OUT-20260310-001`의 `box_count = 7`
  - `OUT-20260311-001`의 `box_count = 3`
- 박스 버튼이 비활성화되어도, 현재 환경의 Box API 비지원이면 문서상 허용된 동작

### 시뮬레이션 예시 C: Storage Billing 상세 검증

1. `Dashboard > Storage Billing`에서 `month`, `warehouse`, `client`를 함께 선택합니다.
2. 필요하면 `rateCbm`, `ratePallet` 값을 직접 넣어 시뮬레이션 계산을 다시 조회합니다.
3. 하단 `SKU CBM Billing Preview`가 열리면 SKU별 `available_qty`, `cbm_m3`, `rate_cbm`, `amount_cbm`를 확인합니다.
4. 상단 요약 금액과 SKU별 금액 합계가 크게 어긋나지 않는지 비교합니다.
5. 경고 메시지나 금액 차이가 있으면 같은 고객의 인보이스 상세 금액과 교차 검증합니다.

체크리스트:
- 필수 필터 조합:
  - `month = 현재 월`
  - `warehouse = WH201`
  - `client = C101`
- 위 조건을 함께 선택해야 `SKU CBM Billing Preview` 카드가 열리는 것이 정상
- 추가 확인값:
  - `rateCbm`, `ratePallet` 수동 입력 시 결과가 즉시 바뀌는지
  - 경고 컬럼(`warnings`)에 예상치 못한 메시지가 없는지
  - 인보이스 총액 `9,600 KRW`와 큰 괴리가 없는지

### 시뮬레이션 예시 D: Capacity 상태 해석

1. `Dashboard > Capacity`에서 날짜와 창고를 선택해 조회합니다.
2. 상태가 `ok`이면 정상 범위, `warn`이면 주의, `critical`이면 과적 임계 상태로 해석합니다.
3. `capacity not set`가 보이면 적재율 자체보다 창고 기준용량 설정 누락을 먼저 의심합니다.
4. 전일 대비 변화량(Δ)이 급증한 창고는 입고/출고 처리 누락이나 급격한 물량 증가 여부를 추가로 확인합니다.

체크리스트:
- 조회 기준:
  - `warehouse = WH201` 우선 확인
  - 날짜는 현재일 또는 시드 적용 직후 날짜 사용
- 상태 해석:
  - `ok`: 정상
  - `warn`: 주의
  - `critical`: 과적 위험
  - `capacity not set`: 창고 기준용량 미설정
- 확인 포인트:
  - 같은 날짜 재조회 시 상태와 수치가 일관적인지
  - 전일 대비 Δ가 급격히 크면 입고 200 / 출고 70 / 예약 30 흐름과 맞는지

### 정산 데모 데이터만 추가

1. `apps/api`에서 `npm run seed:billing-demo`
2. 서비스 요율, 환율, billing 이벤트, invoice 초안을 보강

### 현실형 샘플 10건

- [seed_sample_realistic_10x.sql](D:/codex/wms/apps/api/sql/seed/seed_sample_realistic_10x.sql)을 직접 적용
- 고객 10개, 입고/출고/재고 흐름을 한 번에 확보

### 재시드 전 주의사항

1. 상대 날짜 시드는 "파일이 바뀌는 것"만으로 화면 데이터가 자동 변경되지 않습니다. 서버 DB에 다시 적용해야 현재 월 기준 날짜로 보입니다.
2. 기존 테스트 데이터가 이미 남아 있으면, 새 시드를 넣어도 과거 데이터와 최신 데이터가 같이 보일 수 있습니다.
3. 운영 DB에서 바로 재시드하기 전에 반드시 대상 환경이 개발/검증 DB인지 먼저 확인합니다.
4. 기존 인보이스, 정산 이벤트, 재고 거래 이력을 유지해야 하는 환경이라면 전체 초기화 대신 필요한 시드만 선택 적용합니다.
5. `seed:phase1-integrated`는 통합 검증용 데이터를 한 번에 넣으므로, 기존 검증 결과와 섞이지 않게 사전 정리 여부를 먼저 결정해야 합니다.
6. 적용 후에는 `Inbounds`, `Outbounds`, `Billing Events`, `Invoices`, `Dashboard`를 순서대로 열어 현재 월 기준 데이터가 보이는지 확인합니다.

## 8. 수동 테스트 방법

### 7.1 공통 스모크 테스트

1. `/login` 접속
2. 관리자 계정 로그인
3. 좌측 메뉴 `Inbounds / Outbounds / Inventory / Billing / Dashboard / Settings` 노출 확인
4. 각 화면 진입 후 목록이 1건 이상 보이는지 확인
5. `/guide` 진입 후 가이드 문구 표시 확인

### 7.2 역할별 테스트

#### Admin

1. 기준정보 생성/수정/삭제
2. Billing Settings 생성/수정/삭제
3. Billing Events에서 `Mark as Pending (Admin)` 실행
4. 인보이스 `Generate -> Issue -> Mark Paid`
5. 인보이스 상세에서 `Duplicate (Admin)` 확인

#### Manager

1. Clients/Products/Warehouses 쓰기 가능 확인
2. Billing Settings 수정 불가 확인
3. 인보이스 일반 액션 가능 확인
4. `Duplicate (Admin)` 미노출 확인

#### Warehouse

1. 일반 기준정보 쓰기 가능 확인
2. Billing Settings 수정 불가 확인
3. 출고/재고 업무 반영 확인

#### Client Viewer

1. 기본 진입 경로가 `/billing`인지 확인
2. `Inbounds`, `Settings` 메뉴 비노출 확인
3. Billing 탭에서 Invoices만 보이는지 확인
4. 자기 고객사 데이터만 보이는지 확인

### 7.3 업무 흐름 테스트

#### 입고 -> 재고 반영

1. Inbounds에서 입고 완료 처리
2. Inventory에서 해당 상품 수량 증가 확인
3. Stock Transactions에서 inbound 기록 확인

#### 출고 -> 재고/정산 반영

1. Outbounds에서 출고 오더 확인
2. 필요 시 박스 정보 수정
3. `shipped` 처리
4. Inventory에서 수량 감소 확인
5. Billing Events에서 이벤트 생성 여부 확인

#### 정산 -> 발행 -> 수납

1. Billing Events에서 월/고객 필터로 대상 확인
2. Invoices에서 `Generate`
3. 상세에서 합계, 환율, 품목 라인 검토
4. `Issue`
5. `Mark Paid`
6. 필요 시 `Export Invoice` 수행

### 7.4 대시보드 테스트

1. `/dashboard/storage-trend`에서 기간 필터 조회
2. CSV 다운로드
3. 클립보드 복사
4. PNG 캡처
5. 비프로덕션 환경에서 데이터가 비어 있을 때만 `Generate Snapshots` 버튼 동작 확인
6. `/dashboard/storage-billing`과 `/dashboard/capacity`도 동일하게 확인

## 8. 자동 테스트 방법

### 웹 정적/빌드 검증

```powershell
cd apps/web
npm run web:check
```

포함 항목:

- TypeScript 타입 검사
- i18n 키 검사
- i18n 스냅샷 검사
- Next.js production build

### 웹 Playwright 스모크

```powershell
cd apps/web
npm run test:e2e:smoke
```

전체 E2E:

```powershell
cd apps/web
npm run test:e2e
```

헤디드 실행:

```powershell
cd apps/web
npm run test:e2e:headed
```

주요 검증 범위:

- 로그인
- 메뉴 노출
- 고객 전용 권한 제한
- `/guide` 페이지 노출

### API 헬스 스모크

```powershell
cd apps/api
npm run test:e2e:health-smoke
```

### API 업무 시나리오 E2E

```powershell
cd apps/api
npm run test:e2e:settlement
npm run test:e2e:reopen-reject
npm run test:e2e:invoice-reuse
npm run test:e2e:insufficient-stock
npm run test:e2e:outbound-detail
npm run test:e2e:inbound-detail
npm run test:e2e:billing-production
```

각 스크립트 의미:

- `test:e2e:settlement`: 정산 생성, 인보이스 발행, 재오픈 흐름 핵심
- `test:e2e:reopen-reject`: 정산 재오픈 요청 거절 흐름
- `test:e2e:invoice-reuse`: 이미 발행된 인보이스 재사용 검증
- `test:e2e:insufficient-stock`: 재고 부족 출고 예외 검증
- `test:e2e:outbound-detail`: 출고 상세, 박스, 할당 관련 검증
- `test:e2e:inbound-detail`: 입고 상세와 상태 반영 검증
- `test:e2e:billing-production`: 실운영형 billing 흐름 검증

## 9. 자주 놓치는 기능

- Billing Events CSV 내보내기
- 관리자 전용 Pending 복원
- 인보이스 상세 `Duplicate (Admin)`
- 인보이스 Export 로그
- Dashboard의 CSV/클립보드/PNG 내보내기
- Dashboard 스냅샷 생성 버튼은 비프로덕션 환경 전용
- Storage Rates 설정
- Exchange Rate 스냅샷 기반 환산
- Outbound 박스 CRUD
- Outbound allocation suggestions API
- Inbound/Outbound action logs API
- Settlement reopen request / approve / reject / log API

## 10. 데이터가 안 보일 때 점검 순서

1. 상단 데이터 모드 배지가 예상 환경인지 확인
2. 날짜/월/고객 필터를 초기화하고 다시 조회
3. `client_viewer`라면 자기 고객사 스코프로 잘려 보이는지 확인
4. `/health/db`에서 billing readiness 확인
5. 필요한 seed가 들어갔는지 확인
6. Dashboard라면 snapshot 부족 경고가 있는지 확인하고, 프로덕션에서는 버튼이 없을 수 있음을 전제
7. 정산 화면이라면 대상 월에 이벤트가 존재하는지 먼저 확인

## 11. 참고 문서

- [docs/playwright-smoke-tests-ko.md](D:/codex/wms/docs/playwright-smoke-tests-ko.md)
- [docs/role-test-checklist-ko.md](D:/codex/wms/docs/role-test-checklist-ko.md)
- [apps/api/README.md](D:/codex/wms/apps/api/README.md)
