interface CustomerGroupFiltersProps {
  onClearFilters: () => void
}

export function CustomerGroupFilters({ onClearFilters }: CustomerGroupFiltersProps) {
  // 워크스페이스 필터 제거됨 - localStorage의 selectedWorkspace 기준으로 조회
  return null
}
