/**
 * Shared types for campaign creation
 */

export interface EmailStep {
  id?: string // Step ID if it exists in DB
  stepOrder: number
  delayDays: number
  scheduledHour: number
  scheduledMinute: number
  emailSubject: string
  emailBodyText: string
  isDraft?: boolean
  files?: File[]
  isAdvertisement?: boolean
  emailSignature?: string // 서명을 별도로 저장
}
