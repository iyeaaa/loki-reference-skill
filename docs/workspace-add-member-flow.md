# 워크스페이스 멤버 추가 기능 상세 설명

## 개요

워크스페이스 정보 수정 모달에서 "멤버 추가" 버튼을 클릭하면 나타나는 UI 흐름과 내부 동작을 상세히 설명합니다.

## 컴포넌트 계층 구조

```
WorkspacesPage (최상위)
├── Edit Workspace Dialog (워크스페이스 정보 수정 모달)
│   └── WorkspaceForm
│       └── WorkspaceMembersSection
│           └── "멤버 추가" 버튼
│
└── AddMemberDialog (독립적으로 렌더링) ← 최상위 레벨에서 관리
```

## 상태 관리

### WorkspacesPage.tsx에서 관리하는 상태

```typescript
// 워크스페이스 수정 모달 상태
const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)

// 멤버 추가 모달 상태 (독립적으로 관리)
const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)

// 현재 편집 중인 워크스페이스의 멤버 목록
const { data: members = [] } = useWorkspaceMembers(
  editingWorkspace?.id || "",
  !!editingWorkspace
)
```

### 핵심 포인트

- **두 개의 독립적인 Dialog**: `editingWorkspace`와 `showAddMemberDialog`는 별도의 상태 변수로 관리
- **서로 영향을 주지 않음**: 한 모달의 열림/닫힘이 다른 모달에 영향을 주지 않음

## 사용자 동작 흐름

### 1. 워크스페이스 수정 모달 열기

```
사용자 액션: 워크스페이스 목록에서 "수정" 버튼 클릭
  ↓
setEditingWorkspace(workspace)
  ↓
Edit Workspace Dialog 표시
  ↓
WorkspaceForm 렌더링 (워크스페이스 기본 정보 표시)
  ↓
WorkspaceMembersSection 렌더링 (멤버 목록 표시)
```

### 2. 멤버 추가 버튼 클릭

```
사용자 액션: "멤버 추가" 버튼 클릭
  ↓
WorkspaceMembersSection.tsx:122
  <Button type="button" onClick={onAddMemberClick}>
  ↓
onAddMemberClick() 호출 (props로 전달받음)
  ↓
WorkspaceForm.tsx:166
  onAddMemberClick={onAddMemberClick || (() => {})}
  ↓
WorkspacesPage.tsx:281
  onAddMemberClick={() => setShowAddMemberDialog(true)}
  ↓
setShowAddMemberDialog(true)
  ↓
AddMemberDialog 표시 (최상위 레벨에서 렌더링)
```

### 3. 멤버 추가 모달 (AddMemberDialog) 표시

#### 모달 위치
- **렌더링 위치**: `WorkspacesPage.tsx:301-308`
- **독립적 렌더링**: Edit Workspace Dialog 외부에서 Portal을 통해 렌더링
- **z-index 관리**: Radix UI의 Dialog 컴포넌트가 자동으로 올바른 z-index 스택 관리

#### 모달 구조

```tsx
<AddMemberDialog
  workspaceId={editingWorkspace.id}
  existingMemberUserIds={members.map((m) => m.userId)}
  isOpen={showAddMemberDialog}
  onClose={() => setShowAddMemberDialog(false)}
/>
```

## AddMemberDialog 상세 동작

### 1. 초기 상태

```typescript
// 사용자 선택 관련 상태
const [selectedUserId, setSelectedUserId] = useState("")
const [selectedUser, setSelectedUser] = useState<User | null>(null)
const [selectedRole, setSelectedRole] = useState<"owner" | "admin" | "member" | "viewer">("member")

// 검색 관련 상태
const [userOpen, setUserOpen] = useState(false)
const [userSearch, setUserSearch] = useState("")
const [debouncedSearch, setDebouncedSearch] = useState("")
```

### 2. 모달 UI 구성

#### 사용자 선택 필드

```tsx
<Popover open={userOpen} onOpenChange={setUserOpen} modal={true}>
  <PopoverTrigger asChild>
    <Button variant="outline" type="button">
      {selectedUser ? selectedUser.username : "사용자 선택"}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
    <Command>
      <CommandInput
        placeholder="사용자 검색..."
        value={userSearch}
        onValueChange={setUserSearch}
      />
      <CommandList>
        {/* 검색 결과 표시 */}
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

**특징:**
- `modal={true}`: Dialog 내부에서 Popover가 올바른 z-index로 렌더링되도록 설정
- `w-[var(--radix-popover-trigger-width)]`: Popover가 트리거 버튼의 너비를 자동으로 따라감
- `align="start"`: 정렬 명시

#### 역할 선택 필드

```tsx
<Select
  value={selectedRole}
  onValueChange={(value) => setSelectedRole(value as "owner" | "admin" | "member" | "viewer")}
>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="owner">소유자</SelectItem>
    <SelectItem value="admin">관리자</SelectItem>
    <SelectItem value="member">멤버</SelectItem>
    <SelectItem value="viewer">뷰어</SelectItem>
  </SelectContent>
</Select>
```

### 3. 사용자 검색 기능

#### Debounce 처리

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(userSearch)
  }, 300)
  return () => clearTimeout(timer)
}, [userSearch])
```

- 사용자가 입력을 멈춘 후 300ms 후에 검색 실행
- 불필요한 API 호출 방지

#### 사용자 목록 조회

```typescript
const { data: usersData, isLoading } = useUsers(
  {
    search: debouncedSearch,
    limit: 50,
    page: 1,
  },
  { enabled: debouncedSearch.length > 0 }
)
```

**특징:**
- 검색어가 있을 때만 API 호출 (`enabled: debouncedSearch.length > 0`)
- 최대 50명까지 조회

#### 기존 멤버 필터링

```typescript
const availableUsers =
  debouncedSearch.length > 0
    ? usersData?.users?.filter((user) => !existingMemberUserIds.includes(user.id)) || []
    : []
```

- 이미 워크스페이스에 속한 멤버는 목록에서 제외

### 4. 멤버 추가 프로세스

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()

  if (!selectedUserId) return

  addMember.mutate(
    {
      workspaceId,
      data: {
        userId: selectedUserId,
        role: selectedRole,
      },
    },
    {
      onSuccess: () => {
        // 폼 초기화
        setSelectedUserId("")
        setSelectedUser(null)
        setSelectedRole("member")
        setUserSearch("")
        setDebouncedSearch("")
        // 모달 닫기
        onClose()
      },
    }
  )
}
```

**프로세스:**
1. Form submit 이벤트 발생
2. 유효성 검사 (selectedUserId 필수)
3. API 호출 (`useAddWorkspaceMember` mutation)
4. 성공 시:
   - 폼 상태 초기화
   - 모달 닫기
   - 멤버 목록 자동 갱신 (React Query의 invalidateQueries)

### 5. 모달 닫기

```typescript
const handleClose = () => {
  setSelectedUserId("")
  setSelectedUser(null)
  setSelectedRole("member")
  setUserSearch("")
  setDebouncedSearch("")
  onClose()
}
```

**호출 시점:**
- "취소" 버튼 클릭
- Dialog의 X 버튼 클릭
- Dialog 외부 영역 클릭
- 멤버 추가 성공

## 중첩 Dialog 문제 해결 방법

### 이전 구조 (문제 발생)

```
WorkspacesPage
  └── Edit Workspace Dialog
        └── WorkspaceForm
              └── WorkspaceMembersSection
                    └── AddMemberDialog ← 여기서 렌더링 (중첩)
```

**문제점:**
- AddMemberDialog가 열릴 때 부모 Dialog의 `onOpenChange` 이벤트 트리거
- Edit Workspace Dialog가 의도치 않게 닫힘

### 현재 구조 (해결)

```
WorkspacesPage
  ├── Edit Workspace Dialog
  │     └── WorkspaceForm
  │           └── WorkspaceMembersSection
  │                 └── 버튼 클릭 시 이벤트만 전달
  │
  └── AddMemberDialog ← 최상위 레벨에서 독립적으로 렌더링
```

**해결 방법:**
1. **상태 끌어올리기**: `showAddMemberDialog` 상태를 WorkspacesPage로 이동
2. **이벤트 위임**: 하위 컴포넌트는 `onAddMemberClick` 콜백만 호출
3. **독립적 렌더링**: AddMemberDialog를 최상위 레벨에서 렌더링
4. **Dialog 상태 분리**: 각 Dialog가 독립적인 상태 변수로 관리됨

### onOpenChange 개선

```typescript
// Before (문제 발생)
<Dialog open={!!editingWorkspace} onOpenChange={() => setEditingWorkspace(null)}>

// After (해결)
<Dialog open={!!editingWorkspace} onOpenChange={(open) => !open && setEditingWorkspace(null)}>
```

- Dialog가 **실제로 닫힐 때만** (open === false) 상태 업데이트
- 중첩 Dialog 열림 시 부모 Dialog 유지

## React Query 캐시 무효화

멤버 추가 성공 시 자동으로 멤버 목록이 갱신되는 이유:

```typescript
// useAddWorkspaceMember hook (workspaces.ts:162-187)
export function useAddWorkspaceMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, data }) =>
      workspacesApi.addMember(workspaceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(variables.workspaceId),
      })
      toast.success("멤버가 추가되었습니다")
    },
  })
}
```

**동작:**
1. 멤버 추가 API 성공
2. `workspaceKeys.members(workspaceId)` 쿼리 무효화
3. WorkspacesPage의 `useWorkspaceMembers` 자동 리패치
4. WorkspaceMembersSection에 업데이트된 멤버 목록 표시

## 요약

### 사용자가 "멤버 추가" 버튼을 눌렀을 때

1. **모달 표시**: AddMemberDialog가 화면에 나타남
2. **독립적 렌더링**: Edit Workspace Dialog는 그대로 유지됨
3. **사용자 검색**: 검색어 입력 시 debounce 후 사용자 검색
4. **필터링**: 이미 멤버인 사용자는 목록에서 제외
5. **역할 선택**: owner, admin, member, viewer 중 선택 (기본값: member)
6. **추가**: "추가" 버튼 클릭 시 API 호출
7. **성공**:
   - 멤버 목록 자동 갱신
   - 모달 닫기
   - 성공 토스트 표시
8. **실패**: 에러 토스트 표시

### 기술적 특징

- ✅ Dialog 중첩 문제 해결 (독립적 렌더링)
- ✅ 상태 관리 분리 (각 Dialog 독립적)
- ✅ Debounce 검색 (성능 최적화)
- ✅ 기존 멤버 필터링 (중복 방지)
- ✅ React Query 캐시 자동 갱신
- ✅ 폼 유효성 검사
- ✅ 타입 안정성 (TypeScript)
