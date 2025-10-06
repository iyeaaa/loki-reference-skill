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
 * Decode content based on Content-Transfer-Encoding
 */
function decodeContent(content: string, encoding?: string): string {
  if (!encoding || encoding === "7bit" || encoding === "8bit") {
    return content
  }

  if (encoding === "base64") {
    try {
      // Remove whitespace and decode base64
      const cleaned = content.replace(/\s/g, "")
      return Buffer.from(cleaned, "base64").toString("utf-8")
    } catch (error) {
      console.error("Failed to decode base64:", error)
      return content
    }
  }

  if (encoding === "quoted-printable") {
    // Basic quoted-printable decoding
    return content
      .replace(/=\r?\n/g, "") // Remove soft line breaks
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
  }

  return content
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
        // Extract encoding
        const encodingMatch = part.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
        const encoding = encodingMatch?.[1]?.trim().toLowerCase()

        const textMatch = part.match(/\r?\n\r?\n([\s\S]+?)(?=\r?\n--|\r?\n$|$)/)
        if (textMatch?.[1]) {
          text = decodeContent(textMatch[1].trim(), encoding)
        }
      }

      // Check for HTML part
      if (part.includes("Content-Type: text/html")) {
        // Extract encoding
        const encodingMatch = part.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
        const encoding = encodingMatch?.[1]?.trim().toLowerCase()

        const htmlMatch = part.match(/\r?\n\r?\n([\s\S]+?)(?=\r?\n--|\r?\n$|$)/)
        if (htmlMatch?.[1]) {
          html = decodeContent(htmlMatch[1].trim(), encoding)
        }
      }
    }
  } else {
    // Simple email - try to find body after headers
    const headersPart = emailContent.split(/\r?\n\r?\n/)[0] || ""
    const body = emailContent
      .substring(headersPart.length)
      .replace(/^\r?\n\r?\n/, "")
      .trim()

    if (!body) {
      return { text: undefined, html: undefined }
    }

    // Extract encoding from headers
    const encodingMatch = headersPart.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
    const encoding = encodingMatch?.[1]?.trim().toLowerCase()

    // Extract content type
    const contentTypeMatch = headersPart.match(/Content-Type:\s*([^\r\n;]+)/i)
    const contentType = contentTypeMatch?.[1]?.trim().toLowerCase()

    // Decode the body
    const decodedBody = decodeContent(body, encoding)

    // Determine if it's HTML or text based on content type or content
    if (
      contentType?.includes("text/html") ||
      decodedBody.includes("<html") ||
      decodedBody.includes("<HTML") ||
      decodedBody.includes("<!DOCTYPE")
    ) {
      html = decodedBody
    } else {
      text = decodedBody
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

/**
 * Parse RFC 822 email headers from raw email content
 * Extracts Message-ID, In-Reply-To, and References headers
 *
 * @param emailContent - Full RFC 822 email content or headers string
 * @returns { messageId, inReplyTo, references }
 */
export function parseEmailHeaders(emailContent: string): {
  messageId: string | undefined
  inReplyTo: string | undefined
  references: string[]
} {
  let messageId: string | undefined
  let inReplyTo: string | undefined
  const references: string[] = []

  if (!emailContent) {
    return { messageId, inReplyTo, references }
  }

  // Extract the headers section (before the first blank line)
  const headerSection = emailContent.split(/\r?\n\r?\n/)[0] || emailContent

  // Parse Message-ID
  // Format: Message-ID: <1759766737118.l4n09bwtdc@send.grinda.ai>
  const messageIdMatch = headerSection.match(/^Message-ID:\s*(.+)$/im)
  if (messageIdMatch?.[1]) {
    messageId = messageIdMatch[1].trim()
  }

  // Parse In-Reply-To
  // Format: In-Reply-To: <1759766737118.l4n09bwtdc@send.grinda.ai>
  const inReplyToMatch = headerSection.match(/^In-Reply-To:\s*(.+)$/im)
  if (inReplyToMatch?.[1]) {
    inReplyTo = inReplyToMatch[1].trim()
  }

  // Parse References
  // Format: References: <id1@example.com> <id2@example.com>
  // Can span multiple lines with continuation (starts with whitespace)
  const referencesMatch = headerSection.match(/^References:\s*(.+?)(?=\r?\n(?![\\s]))/ims)
  if (referencesMatch?.[1]) {
    const referencesStr = referencesMatch[1].replace(/\r?\n\s+/g, " ").trim()
    // Split by whitespace and filter out empty strings
    const refIds = referencesStr.split(/\s+/).filter((ref) => ref.length > 0)
    references.push(...refIds)
  }

  return { messageId, inReplyTo, references }
}
