interface Email {
  id: string
  from: string
  to: string
  subject: string
  text?: string
  html?: string
  timestamp: string
  [key: string]: unknown
}

export const emails: Email[] = []
