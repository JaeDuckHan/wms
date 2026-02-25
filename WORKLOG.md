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
