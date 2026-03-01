# Phase1 통합 샘플 데이터(운영유사) 실행 가이드

사용자/테스터가 도메인을 잘 몰라도 순서대로 실행하면,
**입고 -> 재고 -> 출고 -> 서비스이벤트 -> 정산 -> 인보이스(sent)** 까지 한 번에 재현되도록 구성한 seed입니다.

## 실행 순서

1. `seed_testpack_base.sql` (기존 공통 base)
2. `seed_phase1_01_master.sql`
3. `seed_phase1_02_inbound_stock.sql`
4. `seed_phase1_03_outbound_service.sql`
5. `seed_phase1_04_settlement_invoice.sql`
6. `seed_phase1_05_validation.sql` (검증용 조회)

## 파일 위치

- `apps/api/sql/seed/seed_testpack_base.sql`
- `apps/api/sql/seed/seed_phase1_01_master.sql`
- `apps/api/sql/seed/seed_phase1_02_inbound_stock.sql`
- `apps/api/sql/seed/seed_phase1_03_outbound_service.sql`
- `apps/api/sql/seed/seed_phase1_04_settlement_invoice.sql`
- `apps/api/sql/seed/seed_phase1_05_validation.sql`

## 기대 결과(검증 쿼리)

- inbound_received = PASS
- outbound_shipped = PASS
- service_events_ready = PASS
- settlement_closed = PASS
- invoice_sent = PASS
- invoice_amount_match = PASS

## 참고

- 이 데이터셋은 **완전 랜덤 데이터가 아니라 테스트 재현용 운영유사 샘플**입니다.
- 중복 실행해도 동일 상태를 유지하도록 `ON DUPLICATE KEY UPDATE` 기반으로 작성했습니다.
- PK는 테스트 추적용 고정 ID를 일부 사용합니다(700xxx 대역).
