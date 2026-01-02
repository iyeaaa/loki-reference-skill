캠페인 이메일 발송 속도 개선

PR: https://github.com/FINGU-GRINDA/send-grid-test/pull/555

확인해보니 이메일 검증 시 병렬 처리되고 있지 않아서 공식문서 확인하여 병렬처리 되도록 수정 후 배포했습니다.

문제 현황
• 694건 이메일 발송에 약 2시간 소요
• A 워크스페이스 캠페인 완료 전까지 B 워크스페이스 대기
• 원인: Hunter 이메일 검증 API + 순차 처리 구조

근본 원인
• Hunter API Rate Limit: 초당 10건, 분당 300건 제한
• 현재 코드: 1건씩 순차 처리 → API 활용률 10%
• Bulk API 미지원 → 1건씩만 호출 가능

개선 내용
• 순차 처리 → 병렬 처리 (동시 10건)
• p-limit 라이브러리로 동시성 제어
• Hunter API rate limit 100% 활용

예상 효과
• 초당 처리량: 1건 → 10건 (10배)
• 694건 처리: ~11분 → ~1분 10초 (90% 단축)

영향도 분석
• Hunter API: rate limit 준수 (초당 10건 제한 유지)
• SendGrid/Nylas: 영향 없음 (충분한 용량)
• DB: 영향 없음 (독립 레코드 업데이트)
• 에러 처리: 개별 실패해도 다른 작업 계속 진행

결론
• 이메일 발송 속도 약 10배 개선 예상
• 기존 rate limit 준수하여 안정성 유지
• 워크스페이스 간 대기 시간 대폭 감소

---

Campaign Email Sending Speed Improvement

PR: https://github.com/FINGU-GRINDA/send-grid-test/pull/555

After reviewing, I found that email verification was not being processed in parallel. I checked the official documentation and deployed a fix to enable parallel processing.

Problem
• 694 emails took approximately 2 hours to send
• Workspace B had to wait until Workspace A campaign completed
• Root cause: Hunter email verification API + sequential processing

Root Cause
• Hunter API Rate Limit: 10 req/sec, 300 req/min
• Current code: Sequential processing (1 at a time) → Only 10% API utilization
• No Bulk API support → Must call one at a time
• Reference: https://help.hunter.io/en/articles/1970956-hunter-api

Improvements
• Sequential → Parallel processing (10 concurrent)
• Concurrency control with p-limit library
• Hunter API rate limit 100% utilization

Expected Results
• Throughput: 1/sec → 10/sec (10x improvement)
• 694 emails: ~11min → ~1min 10sec (90% reduction)

Impact Analysis
• Hunter API: Rate limit compliant (10 req/sec limit maintained)
• SendGrid/Nylas: No impact (sufficient capacity)
• DB: No impact (independent record updates)
• Error handling: Individual failures don't affect other operations

Conclusion
• Expected 10x improvement in email sending speed
• Stability maintained with rate limit compliance
• Significantly reduced wait time between workspaces
