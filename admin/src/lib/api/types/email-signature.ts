// Email Signature Types
export interface EmailSignature {
  id: string
  userId: string | null
  workspaceId: string | null
  name: string
  signatureHtml: string
  signatureText: string
  isDefault?: boolean // API에서 반환되는 기본 서명 여부 플래그
  isActive: boolean
  createdAt: string
  updatedAt: string
  workspaceName?: string
  userName?: string
  userEmail?: string
}

export interface CreateEmailSignatureRequest {
  name: string
  signatureHtml: string
  signatureText: string
  isActive?: boolean
}

export interface UpdateEmailSignatureRequest {
  name?: string
  signatureHtml?: string
  signatureText?: string
  isActive?: boolean
}
