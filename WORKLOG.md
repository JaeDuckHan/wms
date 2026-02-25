## 2026-02-25

- 웹 UI 한/영 분리 제거 및 통합 표기 적용 (`ko / en` 동시 표기)
- 출고 메뉴 라벨/헤더/브레드크럼 표기 통일 반영
- Demo 모드 토글/배너 비활성화 (사전 오픈 QA 혼선 방지)
- 메뉴/기능별 샘플 데이터 20건 확장
  - Inbounds / Outbounds
  - Inventory (balances, transactions)
  - Settings (clients, products, warehouses)
  - Billing (service rates, exchange rates, contract rates, events, invoices, invoice detail)
- 설정 화면 CRUD 개선
  - Clients / Products / Warehouses에 실제 Delete 동작 추가
  - 생성/수정/삭제 후 카운트 배지 동기화 반영
- 공통 HTTP 유틸 보강 (`DELETE` 응답 처리용 `requestVoid` 추가)
- 한국어 사용 가이드 문서 추가 (`docs/user-guide-ko.md`)
- 상단 Topbar에 `사용 가이드 / Guide` 버튼 추가 및 `/guide` 페이지 연결
- 사전 오픈 CRUD 점검 문서 추가 (`tests/prelaunch_crud_checklist.md`)
- 웹 검증 완료
  - typecheck / i18n check / snapshot 통과
  - production build 통과(샌드박스 EPERM 제외, 권한 실행 기준 성공)

### 다음 작업
- 체크리스트 기준 메뉴별 수동 QA 결과(PASS/FAIL) 로그화
- 정산 메뉴 용어 통일(인보이스/정산서 표기 정책 확정)
- 가이드 페이지 내용 상세화(스크린샷/권한별 시나리오 추가)

---

## WORKLOG 템플릿

## YYYY-MM-DD

- [카테고리] 작업 내용 1
- [카테고리] 작업 내용 2
- [이슈] 확인된 문제/리스크
- [검증] 실행한 명령과 결과

### 다음 작업
- 작업 예정 1
- 작업 예정 2
- 의사결정 필요 항목

### 참고
- 관련 파일:
- 관련 이슈/티켓:
- 비고:
## 2026-02-25

- [web] 사이드바/헤더 ko/en 병기 라벨을 줄바꿈 표기로 통일 (예: 출고\nOutbounds)
- [web] Inbounds/Outbounds/Inventory/Billing에서 API 빈 응답/일부 실패 시 샘플 데이터 폴백 보강
- [web] 정산 생성(Generate) 실패 구간 보강: 엔드포인트 미지원/장애 시 폴백, 월별 pending 이벤트 자동 보충 후 생성
- [web] 대시보드(보관추이/정산/적재율) API 실패 시 탭별 샘플 응답 폴백 추가
- [ops] 런타임 경로 점검 결과 공유: 현재 화면 불일치 원인은 apps/web가 아닌 다른 경로 실행 가능성 확인
- [verify] apps/web typecheck 통과
- [git] main 브랜치에 커밋/푸시 진행

관련 파일:
- apps/web/components/layout/Sidebar.tsx
- apps/web/components/ui/PageHeader.tsx
- apps/web/features/inbound/api.ts
- apps/web/features/outbound/api.ts
- apps/web/features/inventory/api.ts
- apps/web/features/billing/api.ts
- apps/web/features/dashboard/api.ts
