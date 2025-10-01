# 워크플로우 저장 문제 디버깅

## 🔍 문제 상황

**DB의 workflow_data:**
```json
{"data":{}}  // ❌ 비어있음
```

**화면에는 보임:**
- ✅ 생성 모드 표시됨
- ✅ 제목/프롬프트 보임
- ✅ 타이머 시간 보임

## 📊 데이터 흐름

### 1. 노드 편집 시
```
노드 "설정" 버튼 클릭
      ↓
다이얼로그 열림 (로컬 state)
      ↓
프롬프트/제목 입력
      ↓
"저장" 클릭
      ↓
data.onUpdate?.({ generationMode, subject, ... })
      ↓
updateNodeData(nodeId, data) 호출
      ↓
nodes state 업데이트 ✅ (화면에 표시됨)
      ↓
hasChanges = true
      ↓
3초 후 자동 저장
      ↓
handleSave() 호출
      ↓
cleanData 생성 후 JSON.stringify
      ↓
백엔드로 전송
```

### 2. 저장 로직 (현재)
```typescript
const cleanData: Record<string, unknown> = {}

if (node.data.subject !== undefined) cleanData.subject = node.data.subject
if (node.data.bodyText !== undefined) cleanData.bodyText = node.data.bodyText
if (node.data.generationMode !== undefined) cleanData.generationMode = node.data.generationMode
if (node.data.aiPrompt !== undefined) cleanData.aiPrompt = node.data.aiPrompt
if (node.data.useAI !== undefined) cleanData.useAI = node.data.useAI
```

**예상 문제:**
- 이 코드는 맞는데, nodes state에 데이터가 제대로 들어가 있지 않을 수 있음
- 또는 저장 시점에 nodes state가 오래된 값을 참조하고 있을 수 있음

## 🔧 디버깅 방법

**브라우저 콘솔 확인:**
```javascript
// 저장 시 출력되는 로그:
[Workflow Save] Saving workflow data: { nodes: [...], edges: [...] }

// 각 노드의 data 확인:
nodes[0].data = {} 또는 { subject: "...", generationMode: "ai", ... }
```

## 💡 즉시 테스트

1. 시퀀스 디자이너 열기
2. 이메일 노드 "설정" 클릭
3. AI 모드 선택 + 프롬프트 입력
4. "저장" 클릭
5. **브라우저 콘솔 열고 확인:**
   ```
   [Workflow Save] Saving workflow data: ...
   ```
6. 출력된 JSON에서 해당 노드의 data 확인

**예상 출력:**
```json
{
  "nodes": [
    {
      "id": "emailDraft-123",
      "data": {
        "subject": "프롬프트 내용",
        "generationMode": "ai",
        "aiPrompt": "프롬프트 내용",
        "useAI": true
      }
    }
  ]
}
```

**만약 data가 {}로 나온다면:**
- updateNodeData가 제대로 실행되지 않는 것
- handleSave가 오래된 nodes state를 참조하는 것

