## [phase1-inbound-outbound-inventory-log-hardening] - 2026-02-28
- [ ] 재고 반영 시점은 item 등록 시점인가, 상태(`received/shipped`) 전이 시점인가? — 정합성 기준의 핵심
- [ ] 주문 soft delete 시 연관 item/stock/billing 데이터는 어떻게 처리할 것인가? — 조회 정합성 직접 영향
- [ ] 1차의 “로그 적재 보강” 범위에 `billing_events/service_events`를 포함할 것인가? — 범위 폭 결정
- [ ] 1차에서 OpenAPI/README까지 반드시 최신화할 것인가? — QA/운영 혼선 방지
- [ ] 검증 환경에서 `NEXT_PUBLIC_USE_MOCK=false`를 필수 게이트로 둘 것인가? — 화면 검증 신뢰성 확보
- [ ] DB 재적재의 기준 스크립트는 무엇으로 고정할 것인가(`schema_v1.sql + seed_testpack_base.sql` 등)? — 재현성 확보
- [ ] 2차 제외(tenant 강제)로 인해 기존 tenant 관련 테스트 케이스는 이번 1차에서 어떻게 처리할 것인가? — 테스트 실패 해석 기준 필요

