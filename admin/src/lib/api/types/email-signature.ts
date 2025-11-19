// Email Signature Types
export interface EmailSignature {
  id: string
  userId: string
  workspaceId: string
  name: string
  signatureHtml: string
  signatureText: string
  isDefault: boolean
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
  isDefault?: boolean
  isActive?: boolean
}

export interface UpdateEmailSignatureRequest {
  name?: string
  signatureHtml?: string
  signatureText?: string
  isDefault?: boolean
  isActive?: boolean
}

export interface EmailSignaturesParams {
  workspaceId: string | "all"
  userId?: string
  includeInactive?: boolean
}

export interface GetDefaultSignatureParams {
  workspaceId: string
  userId: string
}
