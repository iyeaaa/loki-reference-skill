# 워크플로우 노드 통계 API

타이머 노드에서 실시간 통계를 표시하기 위한 API 명세입니다.

## 개요

각 타이머 노드는 해당 단계의 이메일 발송 및 답장 통계를 실시간으로 표시합니다.
통계는 워크플로우의 노드 ID 기반으로 계산됩니다.

## API 엔드포인트

### GET /api/v1/sequences/:sequenceId/nodes/:nodeId/stats

특정 노드의 통계를 가져옵니다.

#### Request

```
GET /api/v1/sequences/4dd5dd94-5520-41b5-b9bc-0e1ed4b828c5/nodes/timer-1234567890/stats
```

#### Response

```json
{
  "nodeId": "timer-1234567890",
  "sentCount": 150,
  "repliedCount": 45,
  "waitingCount": 85,
  "completedCount": 20
}
```

#### 필드 설명

- `nodeId`: 워크플로우 노드의 고유 ID
- `sentCount`: 이 노드에서 발송된 총 이메일 수
- `repliedCount`: 답장이 온 이메일 수 (시퀀스 종료됨)
- `waitingCount`: 타이머 대기 중인 이메일 수 (답장 대기)
- `completedCount`: 타이머 만료 후 다음 노드로 이동한 이메일 수

## 통계 계산 로직

### 1. sentCount (발송된 이메일)
```sql
SELECT COUNT(*) 
FROM sequence_step_executions
WHERE step_id = (노드 ID에 해당하는 step_id)
  AND status IN ('sent', 'scheduled')
```

### 2. repliedCount (답장 온 이메일)
```sql
SELECT COUNT(*) 
FROM sequence_enrollments
WHERE sequence_id = :sequenceId
  AND status = 'stopped_reply_received'
  AND current_step_order = (현재 노드의 순서)
```

### 3. waitingCount (대기 중인 이메일)
```sql
SELECT COUNT(*) 
FROM sequence_step_executions
WHERE step_id = (노드 ID에 해당하는 step_id)
  AND status = 'scheduled'
  AND scheduled_at > NOW()
```

### 4. completedCount (완료된 이메일)
```sql
SELECT COUNT(*) 
FROM sequence_step_executions
WHERE step_id = (노드 ID에 해당하는 step_id)
  AND status = 'sent'
  AND executed_at IS NOT NULL
  AND (다음 스텝으로 이동함)
```

## 프론트엔드 구현

### 1. TimerNode에서 통계 표시

```tsx
interface TimerNodeData {
  delayDays?: number;
  nodeId?: string;
  sequenceId?: string;
  stats?: {
    sentCount?: number;
    repliedCount?: number;
    waitingCount?: number;
  };
}
```

### 2. SequenceDesigner에서 통계 로드

```tsx
// 주기적으로 통계 갱신 (예: 30초마다)
useEffect(() => {
  const interval = setInterval(() => {
    // 타이머 노드들의 통계 갱신
    nodes
      .filter(node => node.type === 'timer')
      .forEach(node => {
        fetchNodeStats(sequenceId, node.id);
      });
  }, 30000);

  return () => clearInterval(interval);
}, [nodes, sequenceId]);
```

## 데이터 매핑

### workflow_data의 노드 ID와 sequence_steps 연결

워크플로우 노드는 React Flow의 노드 ID를 사용하지만, 
실제 실행 데이터는 `sequence_steps` 테이블에 저장됩니다.

두 가지 방법:
1. **노드 ID를 step_id로 사용**: workflow_data 저장 시 노드를 step으로 변환
2. **매핑 테이블 사용**: workflow_node_mappings 테이블 생성

### 권장 방법: 워크플로우 실행 시 매핑

```typescript
// 워크플로우 저장 시
const workflowData = {
  nodes: [
    { id: 'start', type: 'start', ... },
    { id: 'email-123', type: 'emailDraft', data: { subject: '...', bodyText: '...' } },
    { id: 'timer-456', type: 'timer', data: { delayDays: 3 } },
    { id: 'email-789', type: 'emailDraft', data: { subject: '...', bodyText: '...' } },
  ],
  edges: [...]
};

// 실행 시 sequence_steps 생성 및 매핑
const stepMapping = {
  'email-123': 'step-uuid-1',
  'timer-456': 'step-uuid-2',
  'email-789': 'step-uuid-3',
};
```

## 백엔드 구현 체크리스트

- [ ] GET /api/v1/sequences/:sequenceId/nodes/:nodeId/stats 엔드포인트 생성
- [ ] 노드 ID와 sequence_steps 매핑 로직
- [ ] 통계 계산 쿼리 최적화
- [ ] 캐싱 전략 (Redis 등)
- [ ] 실시간 업데이트 (WebSocket 또는 polling)

## 프론트엔드 구현 체크리스트

- [x] TimerNode에 통계 UI 추가
- [x] 노드 데이터 타입에 stats 필드 추가
- [ ] 통계 fetch API 함수 작성
- [ ] SequenceDesigner에서 주기적 통계 갱신
- [ ] 로딩 상태 및 에러 처리

## 향후 개선 사항

- [ ] WebSocket을 통한 실시간 업데이트
- [ ] 차트로 시간별 통계 시각화
- [ ] 노드별 상세 분석 페이지
- [ ] 이메일 발송 성공률 표시
