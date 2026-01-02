이메일 발송 로직 전체 지연 분석

작성일: 2025-01-02
분석 대상: sendSequenceEmail 함수 (email-sequence-worker-v2.ts)

---

5W1H 요약

• What: 이메일 1건 발송 시 발생하는 모든 I/O 작업 및 지연 요소 분석
• Why: Hunter API 외에도 다른 지연 요소 존재 확인 필요
• Who: 캠페인 발송 속도 개선이 필요한 개발팀
• When: 병렬 처리 1차 개선 후 추가 분석
• Where: elysia-server/src/workers/email-sequence-worker-v2.ts (sendSequenceEmail 함수)
• How: 함수 내부 모든 await 호출 분석

---

현재 상태

• sendSequenceEmail 함수 레벨: 병렬 처리 완료 (p-limit 10)
• 함수 내부 로직: 여전히 순차 실행

---

1건 이메일 발송 시 I/O 작업 목록

정상 케이스 (deliverable 이메일)

1. DB: leadContacts 조회 - ~5ms
2. DB: leads 조회 - ~5ms
3. Hunter API: verifyEmail - 100-200ms (캐시 히트 시)
4. DB: leadIndustryTypes 조회 - ~5ms
5. DB: emails draft 조회 - ~5ms
6. DB: userEmailAccounts 조회 - ~5ms
7. DB: sequenceEnrollments 조회 - ~5ms
8. Email API: sendEmail (SendGrid/Nylas/Unipile) - 50-500ms
9. DB: sequenceEnrollments 업데이트 - ~5ms
10. DB: emails 업데이트/삽입 - ~5ms

총 예상: 200-750ms/건

최악 케이스 (undeliverable → 대체 검색)

정상 케이스: ~200ms
+ 웹사이트 크롤링 (extractWebsiteContent): ~2000ms
+ Gemini API (summarizeCompanyInfo): ~1000ms
+ Hunter verifyEmail: ~200ms
+ Hunter Domain Search: ~300ms
+ Hunter verifyEmail x 5 (for 루프 순차): ~1000ms
+ DB 정리 작업: ~50ms

총 예상: 4,750ms/건 (약 5초)

---

지연 유발 코드 상세

1. Hunter API verifyEmail (라인 169)
• 예상 지연: 100-2000ms
• 현재 상태: 병렬 처리 완료
• Rate Limit: 10 req/sec

2. undeliverable 대체 검색 (라인 191-260)
• extractWebsiteContent: 웹사이트 크롤링 (1-5초)
• summarizeCompanyInfo: Gemini API 호출 (0.5-2초)
• searchDomainAllEmails: Hunter Domain Search (0.1-0.5초)
• verifyEmail x 5: for 루프 순차 실행 (0.5-10초)
• 현재 상태: 순차 실행 (병렬화 안됨)

3. Email 발송 API (라인 613-628)
• SendGrid/Nylas/Unipile API 호출
• 예상 지연: 50-500ms
• 현재 상태: 병렬 처리됨 (함수 레벨)

4. DB 쿼리 6개
• 각각 ~5ms, 총 ~30ms
• 현재 상태: 순차 실행

---

아직 병렬화되지 않은 지연 요소

1. undeliverable 대체 검색 로직
• 위치: 라인 191-260
• 문제: 웹 크롤링 → Gemini → Hunter 순차 실행
• 문제: for 루프에서 verifyEmail 순차 호출 (최대 5회)
• 영향: undeliverable 1건당 최대 5초 추가 지연

2. 독립 DB 쿼리들
• leadContacts, leads, industries, emails, emailAccounts, enrollments
• 독립적이지만 순차 실행 중

---

Action Plan

즉시 조치 (완료)
• sendSequenceEmail 함수 레벨 병렬 처리 (p-limit 10)
• 예상 효과: 10배 속도 향상

추가 개선 (미완료)

1. undeliverable 대체 검색 시 verifyEmail 병렬화 (높음)
• 위치: 라인 243-253 for 루프
• 현재: 순차 실행 (5회 × 200ms = 1초)
• 개선: Promise.all로 병렬 실행 (200ms)
• 예상 효과: 5초 → 1초

2. 독립 DB 쿼리 병렬화 (중간)
• leadContacts + leads + industries 동시 조회
• 예상 효과: 30ms → 10ms

3. 이메일 검증 사전 처리 (낮음)
• 리드 등록 시점에 미리 검증
• 발송 시점 지연 완전 제거

---

결론

• 1차 개선 (완료): 함수 레벨 병렬 처리로 10배 향상
• 2차 개선 (권장): undeliverable 대체 검색 병렬화로 추가 5배 향상 가능
• 3차 개선 (선택): DB 쿼리 병렬화로 미미한 개선

관련 파일
• elysia-server/src/workers/email-sequence-worker-v2.ts
• elysia-server/src/services/hunterio-email-verifier.service.ts
• elysia-server/src/services/lead-enrichment.service.ts
