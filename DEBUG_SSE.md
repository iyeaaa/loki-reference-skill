# SSE 스트리밍 디버깅 가이드

## 🔍 문제 증상
- 챗봇에 질문을 입력하면 로딩 상태만 표시됨
- 진행 상황(Thinking indicator)이 표시되지 않음
- 서버 로그에는 LangGraph 노드들이 정상 실행됨

## 📊 디버깅 단계

### 1️⃣ 브라우저 개발자 도구 열기
1. Chrome/Edge: `F12` 또는 `Cmd+Option+I` (Mac)
2. `Console` 탭 선택
3. 필터에서 "Chatbot" 또는 "SSE" 검색

### 2️⃣ Network 탭에서 SSE 연결 확인
1. `Network` 탭 선택
2. 챗봇에 질문 입력
3. `/api/chatbot/ask` 요청 찾기
4. **Type**이 `eventsource` 또는 `text/event-stream`인지 확인
5. **Status**가 `200` 또는 `(pending)`인지 확인
6. 요청 클릭 → `Response` 탭에서 스트리밍 데이터 확인

### 3️⃣ 예상되는 콘솔 로그

**정상 작동 시:**
```
[Chatbot] Starting to read SSE stream...
[Chatbot] Received event: node analyze
[Chatbot] Thinking update: 💭 질문을 분석하고 있습니다...
[Chatbot] Received event: node generateSQL
[Chatbot] Thinking update: 🔍 SQL 쿼리를 생성하고 있습니다...
...
[Chatbot] Received event: done
[Chatbot] Processing done event
[Chatbot] Stream reading completed
```

**문제 발생 시:**
```
[Chatbot] Starting to read SSE stream...
(여기서 멈춤 - 이벤트를 받지 못함)
```

### 4️⃣ 서버 로그 확인

터미널에서 다음 로그를 찾으세요:

```bash
[SSE] Sending event to client: node analyze
[SSE] Sending event to client: node generateSQL
[SSE] Sending event to client: node validateSQL
...
```

## 🐛 일반적인 문제와 해결책

### 문제 1: CORS 에러
**증상:**
```
Access to fetch at 'http://localhost:3001/api/chatbot/ask' has been blocked by CORS policy
```

**해결:**
- 서버가 실행 중인지 확인: `bun dev` in `elysia-server/`
- CORS 설정 확인 (이미 수정됨)

### 문제 2: SSE 연결이 즉시 종료됨
**증상:** Network 탭에서 요청이 매우 빠르게 완료됨 (10ms 등)

**원인:** ReadableStream이 바로 닫히는 경우

### 문제 3: 이벤트가 전송되지 않음
**증상:** 서버에 `[SSE] Sending event...` 로그가 없음

**확인사항:**
1. LangGraph 노드가 실행되는지 확인
2. controller.enqueue가 호출되는지 확인

### 문제 4: 프론트엔드가 이벤트를 파싱하지 못함
**증상:** `Failed to parse stream event` 에러

**해결:**
- JSON 형식 확인
- TextDecoder 사용 확인

## 🧪 테스트 명령어

### 수동 SSE 테스트 (curl)
```bash
curl -N -H "Content-Type: application/json" \
  -d '{"question":"오늘 발송한 이메일 수는?","workspaceId":"your-workspace-id"}' \
  http://localhost:3001/api/chatbot/ask
```

**예상 출력:**
```
data: {"type":"node","node":"analyze","state":{},"timestamp":1234567890}

data: {"type":"node","node":"generateSQL","state":{},"timestamp":1234567891}

data: {"type":"done"}
```

## 📝 현재 상황 분석

**서버 로그:**
- ✅ LangGraph 노드들이 정상 실행됨
- ✅ 총 18.82초 소요
- ❓ SSE 이벤트 전송 여부 불명확

**다음 단계:**
1. 브라우저 콘솔에서 `[Chatbot]` 로그 확인
2. Network 탭에서 `/api/chatbot/ask` 응답 확인
3. 서버 재시작 후 `[SSE] Sending event...` 로그 확인

## 🔧 임시 해결책

만약 SSE가 작동하지 않으면:
1. 브라우저 새로고침 (Cmd+Shift+R / Ctrl+Shift+R)
2. 서버 재시작 (`bun dev`)
3. 브라우저 캐시 삭제

## 📞 추가 도움

다음 정보를 공유해주세요:
1. 브라우저 콘솔의 `[Chatbot]` 로그
2. Network 탭의 `/api/chatbot/ask` 요청 스크린샷
3. 서버의 `[SSE]` 로그
