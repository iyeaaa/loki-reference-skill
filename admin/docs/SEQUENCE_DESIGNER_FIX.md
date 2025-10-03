# Sequence Designer 버그 수정 완료

## 🐛 발견된 문제들

### 1. 이메일 설정이 저장되지 않음
**증상:**
- 이메일 노드에서 설정 저장
- 디자이너에서 "설정되지 않음"으로 표시
- 활성화 시 "이메일 생성 모드를 선택해주세요" 에러

**원인:**
```typescript
// Before - 특정 필드만 저장
data: {
  subject: node.data.subject,
  bodyText: node.data.bodyText,
  delayDays: node.data.delayDays,
  generationMode: node.data.generationMode,
  aiPrompt: node.data.aiPrompt,
}
// ❌ useAI 등 다른 필드 누락
```

### 2. 자동저장 없음
**증상:**
- 수동으로 저장 버튼 클릭해야 함
- 변경사항 잊어버리기 쉬움

### 3. 노드 데이터 로드 시 반영 안 됨
**증상:**
- 워크플로우 로드 후 노드의 로컬 state가 업데이트되지 않음

## ✅ 수정 사항

### 1. 모든 노드 데이터 저장 ✅
```typescript
// After - 모든 data 보존, callbacks만 제거
const workflowData: WorkflowData = {
  nodes: nodes.map((node) => ({
    ...node,
    data: {
      ...node.data, // ✅ 모든 필드 보존
      // callbacks 제거
      onAddNode: undefined,
      onDelete: undefined,
      onUpdate: undefined,
      onManageEmails: undefined,
      nodeId: undefined,
      sequenceId: undefined,
    },
  })),
  edges,
}
```

### 2. 자동저장 기능 추가 ✅
```typescript
// 변경 후 3초 후 자동 저장 (debounce)
useEffect(() => {
  if (!hasChanges || !id) return

  const timer = setTimeout(() => {
    handleSave()
  }, 3000)

  return () => clearTimeout(timer)
}, [hasChanges, id, handleSave])
```

**UI 인디케이터:**
```typescript
{hasChanges && (
  <div className="flex items-center gap-2 ml-auto">
    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
    <span className="text-xs text-blue-600">3초 후 자동 저장...</span>
  </div>
)}
```

### 3. 노드 데이터 로드 시 state 업데이트 ✅

**EmailDraftNode:**
```typescript
// data가 변경되면 로컬 state 업데이트
useEffect(() => {
  const mode = data.generationMode === "ai" ? "ai" : "manual"
  setGenerationMode(mode)
  setSubject(data.subject || "")
  setBodyText(data.bodyText || "")
  setAiPrompt(data.aiPrompt || "")
}, [data.subject, data.bodyText, data.aiPrompt, data.generationMode])
```

**TimerNode:**
```typescript
// data가 변경되면 로컬 state 업데이트
useEffect(() => {
  setDelayDays(data.delayDays?.toString() || "1")
}, [data.delayDays])
```

### 4. Manual 모드에서 aiPrompt 초기화 ✅
```typescript
} else {
  data.onUpdate?.({
    subject,
    bodyText,
    generationMode: "manual",
    aiPrompt: "", // ✅ manual 모드에서는 aiPrompt 초기화
    useAI: false,
  })
}
```

## 🎯 수정 후 동작

### Before (버그 있음)
```
1. 이메일 노드 설정 저장
2. 디자이너에서 워크플로우 저장
3. ❌ generationMode, aiPrompt 등 일부 필드만 저장
4. 페이지 새로고침 또는 재진입
5. ❌ "설정되지 않음"으로 표시
6. 활성화 시도
7. ❌ "이메일 생성 모드를 선택해주세요" 에러
```

### After (수정 완료)
```
1. 이메일 노드 설정 저장
2. ✅ 3초 후 자동 저장 (또는 수동 저장)
3. ✅ 모든 data 필드 보존하여 저장
4. 페이지 새로고침 또는 재진입
5. ✅ 저장된 설정 그대로 표시
6. ✅ 노드에 설정 정보 표시 (AI 프롬프트 또는 제목 템플릿)
7. 활성화 시도
8. ✅ 검증 통과, 활성화 성공
```

## 📊 동작 흐름

```
노드 설정 변경
    ↓
onUpdate 호출 → nodes state 업데이트
    ↓
hasChanges = true
    ↓
3초 후 자동 저장 (타이머)
    ↓
workflowData JSON 생성 (모든 필드 보존)
    ↓
백엔드 저장 (sequences.workflow_data)
    ↓
hasChanges = false
    ↓
"워크플로우가 저장되었습니다" toast
```

## 🔍 저장되는 데이터 구조

**EmailDraftNode (AI 모드):**
```json
{
  "id": "emailDraft-123",
  "type": "emailDraft",
  "position": { "x": 250, "y": 250 },
  "data": {
    "subject": "프롬프트 내용",
    "bodyText": "",
    "generationMode": "ai",
    "aiPrompt": "프롬프트 내용",
    "useAI": true
  }
}
```

**EmailDraftNode (Manual 모드):**
```json
{
  "id": "emailDraft-456",
  "type": "emailDraft",
  "position": { "x": 250, "y": 450 },
  "data": {
    "subject": "이메일 제목",
    "bodyText": "이메일 본문",
    "generationMode": "manual",
    "aiPrompt": "",
    "useAI": false
  }
}
```

**TimerNode:**
```json
{
  "id": "timer-789",
  "type": "timer",
  "position": { "x": 250, "y": 650 },
  "data": {
    "delayDays": 3
  }
}
```

## ✅ 수정된 파일

1. `admin/src/pages/sequences/designer/SequenceDesigner.tsx`
   - ✅ 자동저장 기능 추가
   - ✅ 모든 node.data 필드 보존
   - ✅ 자동저장 인디케이터 UI

2. `admin/src/pages/sequences/designer/nodes/EmailDraftNode.tsx`
   - ✅ data 변경 시 로컬 state 업데이트
   - ✅ manual 모드에서 aiPrompt 초기화
   - ✅ useEffect 의존성 배열 수정

3. `admin/src/pages/sequences/designer/nodes/TimerNode.tsx`
   - ✅ data 변경 시 로컬 state 업데이트
   - ✅ useEffect import 추가

## 🎉 결과

**이제 다음이 정상 작동합니다:**
1. ✅ 이메일 설정 저장 → 디자이너에 표시됨
2. ✅ 3초 후 자동 저장
3. ✅ 활성화 시 검증 통과
4. ✅ 페이지 재진입 시 모든 설정 유지
5. ✅ Lint 에러 0개

**테스트 시나리오:**
1. 이메일 노드 추가
2. "설정" 클릭 → AI 모드 선택 → 프롬프트 입력 → 저장
3. 3초 대기 (자동 저장)
4. 페이지 새로고침
5. ✅ AI 프롬프트 내용이 노드에 표시됨
6. 타이머 노드 추가 → 3일 설정
7. 시퀀스 활성화
8. ✅ 검증 통과!

