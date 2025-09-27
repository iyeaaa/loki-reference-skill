export interface Email {
  id: string
  from: string
  to: string
  subject: string
  text?: string
  html?: string
  attachments?: Attachment[]
  timestamp: string
}

export interface Attachment {
  filename: string
  content?: string
  type?: string
  size?: number
  mimetype?: string
}

export interface FormData {
  [key: string]: string | undefined
}

export interface FileData {
  fieldname: string
  originalname: string
  mimetype: string
  buffer: Buffer
  size: number
}
