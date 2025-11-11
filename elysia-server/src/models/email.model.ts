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

/**
 * SendGrid Attachment format for outbound emails
 */
export interface SendGridAttachment {
  content: string // Base64 encoded content
  filename: string
  type?: string // MIME type
  disposition?: "attachment" | "inline"
  content_id?: string // For inline images
}

/**
 * SendGrid Inbound Parse Webhook Payload
 *
 * Example data received from webhook:
 * {
 *   "from": "macminim4pro@MACMINIM4PROui-Macmini.local (MACMINIM4PRO)",
 *   "to": "rinda@send.grinda.ai",
 *   "subject": "Webhook Data Analysis Test",
 *   "envelope": "{\"to\":[\"rinda@send.grinda.ai\"],\"from\":\"macminim4pro@MACMINIM4PROui-Macmini.local\"}",
 *   "email": "Received: from MACMINIM4PROui-Macmini.local...",
 *   "SPF": "none",
 *   "dkim": "none",
 *   "sender_ip": "125.138.122.162",
 *   "spam_score": "1.2",
 *   "spam_report": "Spam detection software...",
 *   "charsets": "{\"to\":\"UTF-8\",\"from\":\"UTF-8\",\"subject\":\"UTF-8\"}"
 * }
 */
export interface SendGridInboundPayload {
  // Basic email information
  /** Sender email address with optional display name
   * Example: "macminim4pro@MACMINIM4PROui-Macmini.local (MACMINIM4PRO)" */
  from: string

  /** Recipient email address
   * Example: "rinda@send.grinda.ai" */
  to: string

  /** Email subject line
   * Example: "Webhook Data Analysis Test" */
  subject: string

  /** CC recipients (comma-separated)
   * Example: "user1@example.com, user2@example.com" */
  cc?: string

  /** BCC recipients (comma-separated) */
  bcc?: string

  // Content fields
  /** Plain text body content */
  text?: string

  /** HTML body content */
  html?: string

  /** Complete raw email in RFC 822 format including all headers
   * Example: "Received: from MACMINIM4PROui-Macmini.local (mxd [125.138.122.162])..." */
  email?: string

  // Envelope and routing
  /** SMTP envelope information (JSON string)
   * Example: "{\"to\":[\"rinda@send.grinda.ai\"],\"from\":\"macminim4pro@MACMINIM4PROui-Macmini.local\"}" */
  envelope?: string

  // Security and authentication
  /** SPF validation result
   * Example: "none", "pass", "fail", "softfail" */
  SPF?: string

  /** DKIM signature verification result
   * Example: "none", "pass", "fail" */
  dkim?: string

  /** IP address of the sending mail server
   * Example: "125.138.122.162" */
  sender_ip?: string

  /** SpamAssassin score (numeric string)
   * Example: "1.2" */
  spam_score?: string

  /** Detailed SpamAssassin analysis report
   * Example: "Spam detection software, running on the system..." */
  spam_report?: string

  // Attachments
  /** Number of attachments (JSON string)
   * Example: "2" */
  attachments?: string

  /** Attachment metadata (JSON object as string)
   * Example: "{\"file1.pdf\": {\"type\": \"application/pdf\", \"size\": 12345}}" */
  "attachment-info"?: string

  // Character encoding
  /** Character encoding for email parts (JSON string)
   * Example: "{\"to\":\"UTF-8\",\"from\":\"UTF-8\",\"subject\":\"UTF-8\"}" */
  charsets?: string

  /** Content-ID mapping for inline images (JSON string)
   * Example: "{\"image1.png\": \"cid:12345\"}" */
  "content-ids"?: string

  // Headers (when requested in SendGrid config)
  /** Full email headers (JSON string) */
  headers?: string
}

/**
 * Parsed envelope object
 * Example: { "to": ["rinda@send.grinda.ai"], "from": "sender@example.com" }
 */
export interface SendGridEnvelope {
  to: string[]
  from: string
}

/**
 * Parsed charsets object
 * Example: { "to": "UTF-8", "from": "UTF-8", "subject": "UTF-8" }
 */
export interface SendGridCharsets {
  to?: string
  from?: string
  subject?: string
  text?: string
  html?: string
}

/**
 * Parsed attachment info
 * Example: { "file1.pdf": { "type": "application/pdf", "size": 12345 } }
 */
export interface SendGridAttachmentInfo {
  [filename: string]: {
    type: string
    size: number
    charset?: string
  }
}

/**
 * @deprecated Use SendGridInboundPayload instead
 */
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
