import { useMutation } from "@tanstack/react-query"

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"

type UploadResponse = {
  success: boolean
  data: {
    url: string
  }
  message: string
}

/**
 * 프로필 이미지 업로드 훅
 */
export function useUploadProfileImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`${API_BASE_URL}/api/upload/profile-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "이미지 업로드에 실패했습니다.")
      }

      const result: UploadResponse = await response.json()
      return result.data.url
    },
  })
}

/**
 * 워크스페이스 로고 업로드 훅
 */
export function useUploadWorkspaceLogo() {
  return useMutation({
    mutationFn: async ({
      file,
      workspaceId,
    }: {
      file: File
      workspaceId: string
    }): Promise<string> => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("workspaceId", workspaceId)

      const response = await fetch(`${API_BASE_URL}/api/upload/workspace-logo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "로고 업로드에 실패했습니다.")
      }

      const result: UploadResponse = await response.json()
      return result.data.url
    },
  })
}

/**
 * 이미지 삭제 훅
 */
export function useDeleteImage() {
  return useMutation({
    mutationFn: async (imageUrl: string): Promise<void> => {
      const response = await fetch(`${API_BASE_URL}/api/upload/image`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ imageUrl }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "이미지 삭제에 실패했습니다.")
      }
    },
  })
}
