# Visitor Analytics 프론트엔드 추가 기능

## 1. 랜딩페이지 트래킹 스크립트

### 구현 위치
- rinda.ai 랜딩페이지

### 그린다에이아이 워크스페이스 정보
| 항목 | 값 |
|------|-----|
| Workspace ID | `e490d297-b55a-47f0-9577-8749fec6e77b` |
| 워크스페이스명 | 그린다에이아이 |
| 소유자 | 강호진 (hogingpt@grinda.ai) |
| 웹사이트 | https://www.rinda.ai |

### 필요 코드
```javascript
// 페이지 로드 시 자동 호출 (rinda.ai 랜딩페이지에 삽입)
fetch('https://app.rinda.ai/api/v1/visitors/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workspaceId: 'e490d297-b55a-47f0-9577-8749fec6e77b',
    landingPage: window.location.href,
    referrer: document.referrer
  })
}).catch(() => {});
```

## 2. 설정 페이지 개선 (VisitorAnalyticsPage)

### 현재 상태
- 기본 방문자 목록 표시
- 통계 카드 표시

### 추가 가능 기능
- [ ] 회사별 필터링 드롭다운
- [ ] 날짜 범위 선택기
- [ ] CSV 내보내기 버튼
- [ ] 실시간 업데이트 (polling/websocket)

## 3. ISP 트래픽 표시

### 현재 상태
- 테스트 페이지에서 ISP 제외 알림 표시 (amber 배너)

### 참고
- ISP 트래픽은 DB에 저장되지 않음
- 테스트 페이지에서만 skipped 상태 확인 가능
