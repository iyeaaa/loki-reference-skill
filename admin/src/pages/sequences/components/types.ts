/**
 * Shared types for campaign creation
 */

export type EmailStep = {
  id?: string // Step ID if it exists in DB
  stepOrder: number
  delayDays: number
  scheduledHour: number
  scheduledMinute: number
  emailSubject: string
  emailBodyText: string
  emailBodyHtml?: string // 서명이 포함된 HTML 본문
  isDraft?: boolean
  files?: File[]
  isAdvertisement?: boolean
  emailSignature?: string // 서명 HTML (미리보기용)
  emailSignatureId?: string // 서명 ID (이메일 전송 시 사용)
  includeSignature?: boolean // 서명 포함 여부 (기본값: true)
}
