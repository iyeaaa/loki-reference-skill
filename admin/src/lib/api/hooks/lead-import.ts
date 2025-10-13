/**
 * Lead Import Hooks
 * Excel 파일 업로드 및 리드 임포트를 위한 TanStack Query 훅
 */

import { useMutation, useQuery } from "@tanstack/react-query"
import { fetchSheetNames, type ImportProgress, uploadLeadsFile } from "../services/lead-import"

/**
 * 시트 이름 목록 조회 훅
 */
export function useFetchSheetNames(file: File | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ["sheet-names", file?.name, file?.size],
    queryFn: () => {
      if (!file) {
        throw new Error("파일이 선택되지 않았습니다")
      }
      return fetchSheetNames(file)
    },
    enabled: enabled && !!file,
    staleTime: 0, // 항상 fresh한 데이터로 간주
    gcTime: 0, // 캐시하지 않음 (파일이 변경될 수 있으므로)
    retry: 1,
  })
}

/**
 * 리드 임포트 Mutation 훅
 */
export function useUploadLeads() {
  return useMutation({
    mutationFn: (params: {
      file: File
      workspaceId: string
      sheetName: string
      customerGroupId?: string
      onProgress?: (progress: ImportProgress) => void
    }) => uploadLeadsFile(params),
  })
}
