/**
 * Extract clean email address from various formats
 *
 * Examples:
 * - "이철희 <wks0968@gmail.com>" -> "wks0968@gmail.com"
 * - "GRINDA AI <grindaai1@gmail.com>" -> "grindaai1@gmail.com"
 * - "macminim4pro@MACMINIM4PROui-Macmini.local (MACMINIM4PRO)" -> "macminim4pro@MACMINIM4PROui-Macmini.local"
 * - "user@example.com" -> "user@example.com"
 */
export function extractEmailAddress(emailString: string): string {
  if (!emailString) return ""

  // Pattern 1: Name <email@domain.com>
  const angleBracketMatch = emailString.match(/<([^>]+)>/)
  if (angleBracketMatch?.[1]) {
    return angleBracketMatch[1].trim()
  }

  // Pattern 2: email@domain.com (Name)
  const parenMatch = emailString.match(/^([^\s(]+@[^\s(]+)/)
  if (parenMatch?.[1]) {
    return parenMatch[1].trim()
  }

  // Pattern 3: Just email address
  const emailMatch = emailString.match(/([^\s<>]+@[^\s<>]+)/)
  if (emailMatch?.[1]) {
    return emailMatch[1].trim()
  }

  // Fallback: return as is
  return emailString.trim()
}

/**
 * Parse RFC 822 email content to extract text and HTML parts
 *
 * @param emailContent - Full RFC 822 email content
 * @returns { text: string | undefined, html: string | undefined }
 */
export function parseEmailBody(emailContent: string): {
  text: string | undefined
  html: string | undefined
} {
  if (!emailContent) {
    return { text: undefined, html: undefined }
  }

  let text: string | undefined
  let html: string | undefined

  // Find the boundary marker for multipart emails
  const boundaryMatch = emailContent.match(/boundary="?([^"\s;]+)"?/i)
  const boundary = boundaryMatch ? boundaryMatch[1] : null

  if (boundary) {
    // Multipart email
    const parts = emailContent.split(`--${boundary}`)

    for (const part of parts) {
      // Check for plain text part
      if (part.includes("Content-Type: text/plain")) {
        const textMatch = part.match(/\r?\n\r?\n([\s\S]+?)(?=\r?\n--|\r?\n$|$)/)
        if (textMatch?.[1]) {
          text = textMatch[1].trim()
        }
      }

      // Check for HTML part
      if (part.includes("Content-Type: text/html")) {
        const htmlMatch = part.match(/\r?\n\r?\n([\s\S]+?)(?=\r?\n--|\r?\n$|$)/)
        if (htmlMatch?.[1]) {
          html = htmlMatch[1].trim()
        }
      }
    }
  } else {
    // Simple email - try to find body after headers
    const headerBodySplit = emailContent.split(/\r?\n\r?\n/)
    if (headerBodySplit.length > 1) {
      const body = headerBodySplit.slice(1).join("\n\n").trim()

      // Check if it looks like HTML
      if (body.includes("<html") || body.includes("<HTML") || body.includes("<!DOCTYPE")) {
        html = body
      } else {
        text = body
      }
    }
  }

  return { text, html }
}

/**
 * Extract text content from HTML
 * Simple HTML to text conversion for plain text extraction
 */
export function htmlToText(html: string): string {
  if (!html) return ""

  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove style tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove script tags
    .replace(/<[^>]+>/g, " ") // Remove HTML tags
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim()
}
