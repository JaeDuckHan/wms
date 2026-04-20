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

## 5. 화면별 사용 방법

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

### 5.5 Billing Events `/billing/events`

#### 주요 기능

- 년/월/고객/상태/서비스코드 기준 조회
- `PENDING`, `INVOICED` 상태 확인
- CSV 내보내기
- 관리자용 `Mark as Pending (Admin)`

#### 운영 체크 포인트

- 특정 월만 보려면 년도와 월을 같이 선택
- 연간 흐름을 보려면 년도만 선택
- `INVOICED` 이벤트는 이미 인보이스에 묶인 건인지 확인
- 잘못 묶인 이벤트만 관리자 권한으로 Pending 복원

### 5.6 Invoices `/billing`, `/billing/:id`

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

#### 상태 흐름

- `draft -> issued -> paid`

#### 운영 체크 포인트

- 종료일은 인보이스 기준일과 청구월 계산 기준으로도 사용
- KRW 합계, 원화 환산 전 THB, 환율 스냅샷을 함께 확인
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
- Demo Mode 토글
- 최근 스냅샷 생성
- CSV 다운로드
- 클립보드 복사
- PNG 캡처
- 스냅샷 부족 경고 표시

#### 운영 체크 포인트

- 스냅샷이 없으면 `Generate Snapshots`로 다시 생성
- 같은 조건으로 재조회해 수치 일관성 확인
- 보관 요금 화면에서 고객/창고/월 필터 변경 시 합계가 바뀌는지 확인

### 5.8 Settings `/settings/*`

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

## 6. 샘플 데이터 사용 방법

### 최소 데모 구동

1. 스키마 적용: [schema_v1.sql](D:/codex/wms/apps/api/sql/schema_v1.sql)
2. 최소 마스터 적용: [seed_master_min.sql](D:/codex/wms/apps/api/sql/seed_master_min.sql)
3. API 실행 후 `/health/db` 확인

### 통합 시나리오 준비

1. `apps/api`에서 `npm run seed:phase1-integrated`
2. 입고/출고/정산/인보이스 검증 데이터를 한 번에 준비

### 정산 데모 데이터만 추가

1. `apps/api`에서 `npm run seed:billing-demo`
2. 서비스 요율, 환율, billing 이벤트, invoice 초안을 보강

### 현실형 샘플 10건

- [seed_sample_realistic_10x.sql](D:/codex/wms/apps/api/sql/seed/seed_sample_realistic_10x.sql)을 직접 적용
- 고객 10개, 입고/출고/재고 흐름을 한 번에 확보

## 7. 수동 테스트 방법

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
5. Demo Mode에서 스냅샷 생성 버튼 동작 확인
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
- Dashboard Demo Snapshot 생성
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
6. Dashboard라면 snapshot 부족 경고가 있는지 확인
7. 정산 화면이라면 대상 월에 이벤트가 존재하는지 먼저 확인

## 11. 참고 문서

- [docs/playwright-smoke-tests-ko.md](D:/codex/wms/docs/playwright-smoke-tests-ko.md)
- [docs/role-test-checklist-ko.md](D:/codex/wms/docs/role-test-checklist-ko.md)
- [apps/api/README.md](D:/codex/wms/apps/api/README.md)
