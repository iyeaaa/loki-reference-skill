# 캠페인 이메일 발송 지연 문제 분석

> 작성일: 2025-01-02
> 이슈: 694건 메일 발송에 2시간 소요

---

## 결론: Hunter 이메일 검증 API가 원인인가?

**예, 핵심 원인입니다.** Hunter API의 구조적 제약과 현재 아키텍처가 복합적으로 작용합니다.

---

## Hunter API 공식 Rate Limit (출처: help.hunter.io)

| API | 초당 제한 | 분당 제한 | 적용 범위 |
|-----|----------|----------|----------|
| Email Verifier | 10 req/sec | 300 req/min | API 키 또는 IP당 |
| Domain Search | 15 req/sec | 500 req/min | API 키 또는 IP당 |
| Email Finder | 15 req/sec | 500 req/min | API 키 또는 IP당 |

**중요 제약**: Bulk API 미지원 - 1건씩만 처리 가능
> "Each API call needs to be performed with one piece of data at a time"

---

## 5W1H 요약

• **What**: 캠페인 발송 속도 저하 (694건/2시간) + 워크스페이스 간 블로킹
• **Why**: Hunter API rate limit (10/sec, 300/min) + Bulk 미지원 + 동기식 검증 + 전역 단일 큐
• **Who**: 캠페인 활성화하는 모든 사용자 (멀티 워크스페이스 환경에서 특히 심각)
• **When**: Hunter.io 이메일 검증 기능 추가 이후
• **Where**: `email-sequence-worker-v2.ts` + `hunterio-email-verifier.service.ts`
• **How**: 이메일 1건당 검증 API 호출 → rate limit 병목 → 전역 큐 대기

---

## 근본 원인 분석

### 1. Hunter API Rate Limit (외부 제약)

• Email Verifier: **초당 10개, 분당 300개**
• Bulk API 미지원 - 반드시 1건씩 호출해야 함
• 현재 코드 설정 (`hunterio-email-verifier.service.ts:121-134`): API 제한에 맞게 설정됨

```
694건 검증 소요 시간 계산:
- 이상적: 694건 ÷ 10건/초 = 69.4초 (약 1분 10초)
- 분당 제한 적용: 694건 ÷ 300건/분 = 2.3분
```

### 2. 대체 이메일 검색 시 추가 API 호출

• 파일: `email-sequence-worker-v2.ts:161-252`
• undeliverable 이메일 발견 시:
  - Gemini 웹 추출 → 새 이메일 발견 → `verifyEmail()` 추가 호출
  - Hunter Domain Search → 여러 이메일에 대해 `verifyEmail()` 추가 호출
• **최악의 경우 1건당 5-6회 API 호출**

```
undeliverable 비율 20% 가정:
- 694건 × 20% = 139건 추가 검색
- 139건 × 5회 = 695건 추가 API 호출
- 총 API 호출: 1,389건 → 약 4.6분 추가
```

### 3. 전역 단일 큐 (워크스페이스 분리 없음)

• 파일: `sequence.service.ts:2117-2130`
• 모든 워크스페이스 pending execution을 단일 큐로 처리
• A 워크스페이스 처리 중 → B 워크스페이스 대기
• `ORDER BY scheduled_at` - 선착순 처리

### 4. 동기식 순차 처리

• 파일: `email-sequence-worker-v2.ts:835`
• `for` 루프로 1건씩 순차 처리 (병렬 아님)
• 워커 주기: 60초마다 실행

---

## 694건 2시간 소요 원인 분석

```
1. 기본 검증: 694건 × 0.1초 = 69초
2. 대체 검색 (20%): 139건 × 5회 × 0.1초 = 70초
3. 이메일 발송: 694건 × 0.05초 = 35초
4. 워커 대기: 7 배치 × 60초 = 420초
5. 네트워크 지연/재시도: 약 200초
------------------------------------------
예상: 약 15분

실제 2시간 → 추가 원인 가능성:
- API 202 응답 시 폴링 대기 (2초 × 5회 = 10초/건)
- 캐시 미스율이 높은 경우
- 서버 부하로 인한 지연
```

---

## 트레이드오프

| 기존 | 현재 |
|------|------|
| 존재하지 않는 메일도 발송 → 바운스 발생 | 검증 후 발송 → 바운스 감소, 발송 지연 |

---

## Action Plan

### 즉시 조치

• 배치 사이즈 증가 (100 → 200): 워커 대기 시간 50% 감소
• 캐시 TTL 연장 (7일 → 30일): 반복 검증 감소

### 단기 조치

• **워크스페이스별 병렬 처리**: 각 워크스페이스 독립 큐 운영
• **사전 검증 방식**: 리드 등록 시점에 비동기로 검증 완료

### 중장기 조치

• 자체 이메일 검증 API 개발 (rate limit 해소)
• 또는 더 높은 rate limit 제공하는 서비스로 전환

---

## 아키텍처 개선 제안

```
현재: 발송 시점 동기 검증
┌─────────────────────────────────────────────────────┐
│ 발송 요청 → Hunter 검증(블로킹) → 발송 → DB 저장    │
│             ↑ rate limit 병목                       │
└─────────────────────────────────────────────────────┘

개선안: 사전 비동기 검증
┌─────────────────────────────────────────────────────┐
│ [사전] 리드 등록 → Hunter 검증 → 결과 캐시 저장     │
│ [발송] 발송 요청 → 캐시 조회 → 발송 → DB 저장       │
│                    ↑ 블로킹 없음                    │
└─────────────────────────────────────────────────────┘
```

---

## 관련 파일

• `elysia-server/src/services/hunterio-email-verifier.service.ts` - Rate limit 설정
• `elysia-server/src/workers/email-sequence-worker-v2.ts` - 발송 워커
• `elysia-server/src/services/sequence.service.ts` - 큐 처리 로직

---

## 참고 링크

• Hunter API Rate Limits: https://help.hunter.io/en/articles/1970956-hunter-api
