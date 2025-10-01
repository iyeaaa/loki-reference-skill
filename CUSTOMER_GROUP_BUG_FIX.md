# 고객그룹 리드 추가 버그 수정

## 🐛 발견된 문제

**증상:**
리드 관리에서 새 리드(예: "서현라면")를 추가했는데, 고객그룹에서 해당 리드가 보이지 않음

## 🔍 원인 분석

### 1. React Query 훅 미사용
**파일:** `admin/src/pages/customer-groups/AddMembersDialog.tsx`

**Before:**
```typescript
const handleAddMembers = async () => {
  await customerGroupsApi.bulkAddMembers({ // ❌ 직접 API 호출
    groupId: customerGroup.id,
    leadIds: selectedLeads,
  })
  
  toast.success(`${selectedLeads.length}명의 고객이 그룹에 추가되었습니다.`)
  onSuccess?.()
  onClose()
}
```

**문제점:**
- React Query 훅 대신 직접 API 호출
- `queryClient.invalidateQueries` 실행 안 됨
- 목록이 자동으로 갱신되지 않음

### 2. 중복 추가 가능
이미 그룹에 속한 리드도 다시 선택 가능했음

## ✅ 수정 내용

### 1. React Query 훅 사용 ✅
```typescript
// React Query 훅 import
import { useBulkAddGroupMembers, useCustomerGroupMembers } from "@/lib/api/hooks/customer-groups"

// 훅 사용
const bulkAddMembers = useBulkAddGroupMembers()

const handleAddMembers = async () => {
  await bulkAddMembers.mutateAsync({ // ✅ 훅 사용
    groupId: customerGroup.id,
    leadIds: selectedLeads,
  })
  
  // 성공 시 자동으로:
  // 1. queryClient.invalidateQueries 실행 (useBulkAddGroupMembers 내부)
  // 2. 멤버 목록 자동 갱신
  // 3. 토스트 메시지 자동 표시
}
```

### 2. 이미 추가된 리드 제외 ✅
```typescript
// 현재 그룹 멤버 조회
const { data: membersData } = useCustomerGroupMembers(
  customerGroup?.id || "",
  1,
  1000, // 모든 멤버 조회
  !!customerGroup?.id && isOpen
)
const existingMemberLeadIds = new Set(membersData?.members.map((m) => m.leadId) || [])

// 필터링
const filteredLeads = leads.filter((lead) => {
  // 이미 그룹 멤버인 경우 제외
  if (existingMemberLeadIds.has(lead.id)) {
    return false
  }
  
  // 검색 필터
  if (!searchInput) return true
  const searchLower = searchInput.toLowerCase()
  return (
    lead.companyName?.toLowerCase().includes(searchLower) ||
    lead.websiteUrl?.toLowerCase().includes(searchLower) ||
    lead.businessType?.toLowerCase().includes(searchLower)
  )
})
```

### 3. 사용자 안내 메시지 추가 ✅
```typescript
{existingMemberLeadIds.size > 0 && (
  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
    💡 현재 그룹에 {existingMemberLeadIds.size}명의 고객이 이미 있습니다. 
    이미 추가된 고객은 목록에서 제외됩니다.
  </div>
)}
```

## 🎯 수정 후 동작 흐름

### Before (버그 있음)
```
1. 리드 추가 다이얼로그 열기
2. 리드 선택 (이미 추가된 리드도 선택 가능)
3. "추가" 버튼 클릭
4. API 직접 호출 → DB에는 저장됨
5. 다이얼로그 닫힘
6. ❌ 목록 자동 갱신 안 됨 (사용자가 수동으로 새로고침해야 함)
7. ❌ 중복 추가 가능 (DB 에러 또는 중복 데이터)
```

### After (수정 완료)
```
1. 리드 추가 다이얼로그 열기
2. ✅ 이미 그룹에 속한 리드는 목록에서 제외됨
3. ✅ 현재 그룹 멤버 수 안내 메시지 표시
4. 리드 선택 (새로운 리드만)
5. "추가" 버튼 클릭
6. ✅ React Query mutation 실행
7. ✅ 성공 시 자동으로:
   - invalidateQueries 실행
   - 멤버 목록 자동 갱신
   - 토스트 메시지 표시
8. 다이얼로그 닫힘
9. ✅ 즉시 업데이트된 목록 확인 가능
```

## 🔧 관련 코드

### React Query 훅
**파일:** `admin/src/lib/api/hooks/customer-groups.ts`

```typescript
export function useBulkAddGroupMembers() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkAddMembersRequest) => 
      customerGroupsApi.bulkAddMembers(data),
    onSuccess: (response, variables) => {
      // 자동 갱신!
      queryClient.invalidateQueries({ 
        queryKey: customerGroupKeys.members(variables.groupId) 
      })
      queryClient.invalidateQueries({ 
        queryKey: customerGroupKeys.detail(variables.groupId) 
      })
      toast.success(`${response.addedCount || 0}명의 멤버가 추가되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "멤버 추가에 실패했습니다")
    },
  })
}
```

### 백엔드 API
**파일:** `elysia-server/src/services/customer-group.service.ts`

```typescript
export async function bulkAddMembers(data: {
  groupId: string;
  leadIds: string[];
  addedBy?: string;
}) {
  const values = data.leadIds.map((leadId) => ({
    groupId: data.groupId,
    leadId,
    addedBy: data.addedBy || null,
  }));

  const result = await db
    .insert(customerGroupMembers)
    .values(values)
    .returning({ id: customerGroupMembers.id });

  return result.length;
}
```

## ✅ 테스트 시나리오

1. **새 리드 추가 → 고객그룹에 추가**
   - ✅ 리드 생성
   - ✅ 고객그룹 "고객 추가" 클릭
   - ✅ 새 리드가 목록에 표시됨
   - ✅ 선택 후 추가
   - ✅ 즉시 목록에서 사라짐 (이미 추가됨으로 필터링)

2. **이미 추가된 리드 확인**
   - ✅ "고객 추가" 다시 클릭
   - ✅ 이미 추가된 리드는 목록에 없음
   - ✅ 안내 메시지: "현재 그룹에 N명의 고객이 이미 있습니다"

3. **목록 자동 갱신**
   - ✅ 리드 추가 후 다이얼로그 닫기
   - ✅ 고객그룹 상세 페이지 자동 갱신
   - ✅ 수동 새로고침 불필요

## 📋 Lint 검사 결과

```bash
✅ admin/src/pages/customer-groups/AddMembersDialog.tsx - No errors
```

## 💡 추가 개선사항

### 1. 중복 추가 방지 (백엔드)
현재는 프론트엔드에서만 필터링. 백엔드에서도 중복 체크 추가 권장:

```typescript
// elysia-server/src/services/customer-group.service.ts
export async function bulkAddMembers(data: {
  groupId: string;
  leadIds: string[];
}) {
  // 이미 존재하는 멤버 제외
  const existing = await db
    .select({ leadId: customerGroupMembers.leadId })
    .from(customerGroupMembers)
    .where(eq(customerGroupMembers.groupId, data.groupId))
  
  const existingIds = new Set(existing.map(e => e.leadId))
  const newLeadIds = data.leadIds.filter(id => !existingIds.has(id))
  
  if (newLeadIds.length === 0) {
    return 0 // 이미 모두 추가됨
  }
  
  const values = newLeadIds.map((leadId) => ({
    groupId: data.groupId,
    leadId,
    addedBy: data.addedBy || null,
  }))
  
  const result = await db
    .insert(customerGroupMembers)
    .values(values)
    .returning({ id: customerGroupMembers.id })
    
  return result.length
}
```

### 2. 유니크 제약 조건 추가 (DB)
```sql
ALTER TABLE customer_group_members 
ADD CONSTRAINT unique_group_lead 
UNIQUE (group_id, lead_id);
```

이렇게 하면 중복 추가가 DB 레벨에서 차단됩니다.

## 🎉 결론

**고객그룹 리드 추가 기능 완벽히 수정 완료!**
- ✅ 자동 목록 갱신
- ✅ 중복 추가 방지
- ✅ 사용자 안내 메시지
- ✅ Lint 에러 0개

