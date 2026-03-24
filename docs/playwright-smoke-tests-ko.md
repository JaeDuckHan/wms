# Playwright 스모크 테스트 가이드

## 목적

- 배포된 WMS 사이트를 브라우저 기준으로 빠르게 점검한다.
- 로그인, 메뉴 노출, 고객 전용 접근, 가이드 페이지 노출 같은 핵심 흐름을 자동으로 확인한다.

## 테스트 대상

- 기본 대상 URL: `https://3pl.kowinsblue.com`
- Playwright 설정 파일: [playwright.config.ts](D:\codex\wms\apps\web\playwright.config.ts)
- 스모크 테스트 파일: [smoke.spec.ts](D:\codex\wms\apps\web\tests\e2e\smoke.spec.ts)

## 포함된 시나리오

### 1. 관리자 스모크

- `/login` 접속
- `admin@example.com / x` 로그인
- 기본 랜딩이 `/outbounds` 인지 확인
- `Inbounds`, `Outbounds`, `Inventory`, `Billing`, `Dashboard`, `Settings` 메뉴 노출 확인
- `/guide` 페이지 진입 및 기본 가이드 문구 확인

### 2. 고객 조회 계정 스모크

- `/login` 접속
- `viewer101@example.com / x` 로그인
- 기본 랜딩이 `/billing` 인지 확인
- 고객 전용 메뉴만 노출되는지 확인
- `Inbounds`, `Settings` 메뉴 숨김 확인
- Billing 탭에서 `Invoices` 만 보이는지 확인
- `/inventory` 진입 후 `Available`, `Reserved`, `Allocatable` 표시 확인

## 실행 준비

1. Node.js 와 npm 설치
2. `apps/web` 의존성 설치
3. Playwright 브라우저 설치
4. 테스트 대상 사이트 접속 가능 네트워크 확인

## 실행 명령

```bash
cd apps/web
npm install
npx playwright install chromium
npm run test:e2e:smoke
```

전체 E2E:

```bash
cd apps/web
npm run test:e2e
```

브라우저를 띄워서 확인:

```bash
cd apps/web
npm run test:e2e:headed
```

## 환경변수

기본값을 바꾸고 싶으면 아래 환경변수를 사용한다.

- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_ADMIN_EMAIL`
- `PLAYWRIGHT_ADMIN_PASSWORD`
- `PLAYWRIGHT_CLIENT_VIEWER_EMAIL`
- `PLAYWRIGHT_CLIENT_VIEWER_PASSWORD`

예시:

```bash
PLAYWRIGHT_BASE_URL=https://3pl.kowinsblue.com npm run test:e2e:smoke
```

## 결과물

- HTML 리포트: `apps/web/playwright-report`
- 실패 스크린샷/trace/video: `apps/web/test-results`

## 주의사항

- 이 테스트는 실제 운영 또는 스테이징 계정을 사용하므로, 쓰기 액션은 넣지 않았다.
- 현재 스모크는 조회와 메뉴/접근 제어 검증 위주다.
- 인보이스 생성, 발행, 수납 같은 쓰기 시나리오는 별도 QA 환경에서 추가하는 것이 안전하다.
