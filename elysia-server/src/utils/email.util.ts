import iconv from "iconv-lite"

/**
 * Decode RFC 2047 encoded-word format
 * Format: =?charset?encoding?encoded_text?=
 * Example: =?utf-8?B?7LmZ67CU7J207LmZ?= -> 칙바이칙
 *
 * @param text - Text that may contain RFC 2047 encoded-words
 * @returns Decoded text
 */
export function decodeRfc2047(text: string): string {
  if (!text) return text

  // RFC 2047 encoded-word pattern: =?charset?encoding?encoded_text?=
  const encodedWordRegex = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g

  return text.replace(
    encodedWordRegex,
    (match, charset: string, encoding: string, encodedText: string) => {
      try {
        const normalizedCharset = charset.toLowerCase().trim()
        const encodingType = encoding.toUpperCase()

        let buffer: Buffer

        if (encodingType === "B") {
          // Base64 encoding
          buffer = Buffer.from(encodedText, "base64")
        } else if (encodingType === "Q") {
          // Quoted-Printable encoding (with _ = space)
          const decoded = encodedText
            .replace(/_/g, " ") // In Q encoding, _ represents space
            .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => {
              return String.fromCharCode(Number.parseInt(hex, 16))
            })
          buffer = Buffer.from(decoded, "latin1")
        } else {
          return match // Unknown encoding, return as-is
        }

        // Decode with proper charset
        if (iconv.encodingExists(normalizedCharset)) {
          return iconv.decode(buffer, normalizedCharset)
        }

        // Fallback to UTF-8
        return buffer.toString("utf-8")
      } catch (error) {
        console.error("Failed to decode RFC 2047 encoded-word:", error)
        return match // Return original on error
      }
    },
  )
}

/**
 * Sanitize filename while preserving Unicode characters (Korean, Japanese, Chinese, etc.)
 * Only removes characters that are problematic for filesystems
 *
 * @param filename - Original filename
 * @returns Sanitized filename safe for filesystem
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return filename

  // First decode any RFC 2047 encoded-word format
  const decoded = decodeRfc2047(filename)

  // Remove or replace only filesystem-unsafe characters
  // Preserve Unicode letters (Korean, Japanese, Chinese, etc.)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Intentionally removing control characters from filenames
  const unsafeCharsPattern = /[<>:"/\\|?*\x00-\x1f]/g
  return decoded
    .replace(unsafeCharsPattern, "_") // Filesystem unsafe characters
    .replace(/\.{2,}/g, ".") // Multiple dots
    .replace(/^\.+|\.+$/g, "") // Leading/trailing dots
    .trim()
}

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
 * Decode content based on Content-Transfer-Encoding and charset
 */
function decodeContent(content: string, encoding?: string, charset?: string): string {
  const decoded = content

  // Step 1: Decode transfer encoding (base64, quoted-printable)
  if (encoding && encoding !== "7bit" && encoding !== "8bit") {
    if (encoding === "base64") {
      try {
        // Remove whitespace and decode base64
        const cleaned = content.replace(/\s/g, "")
        const buffer = Buffer.from(cleaned, "base64")

        // If charset is specified, decode with that charset
        if (charset && iconv.encodingExists(charset)) {
          return iconv.decode(buffer, charset)
        }

        return buffer.toString("utf-8")
      } catch (error) {
        console.error("Failed to decode base64:", error)
        return content
      }
    }

    if (encoding === "quoted-printable") {
      try {
        const withoutSoftBreaks = content.replace(/=\r?\n/g, "")

        const bytes: number[] = []
        let i = 0
        while (i < withoutSoftBreaks.length) {
          if (withoutSoftBreaks[i] === "=" && i + 2 < withoutSoftBreaks.length) {
            const hex = withoutSoftBreaks.substring(i + 1, i + 3)
            bytes.push(Number.parseInt(hex, 16))
            i += 3
          } else {
            bytes.push(withoutSoftBreaks.charCodeAt(i))
            i++
          }
        }

        const buffer = Buffer.from(bytes)

        if (charset && iconv.encodingExists(charset)) {
          return iconv.decode(buffer, charset)
        }

        return buffer.toString("utf-8")
      } catch (error) {
        console.error("Failed to decode quoted-printable:", error)
        return content
      }
    }
  }

  // Step 2: Decode character encoding (charset) for non-quoted-printable content
  if (charset && charset.toLowerCase() !== "utf-8" && charset.toLowerCase() !== "utf8") {
    try {
      // Convert charset name to iconv-lite compatible format
      const normalizedCharset = charset.toUpperCase().replace(/[^A-Z0-9-]/g, "")

      // Common charset aliases
      const charsetMap: Record<string, string> = {
        "ISO-2022-JP": "ISO-2022-JP",
        ISO2022JP: "ISO-2022-JP",
        SHIFT_JIS: "SHIFT_JIS",
        SHIFTJIS: "SHIFT_JIS",
        "EUC-JP": "EUC-JP",
        EUCJP: "EUC-JP",
        "EUC-KR": "EUC-KR",
        EUCKR: "EUC-KR",
        GB2312: "GB2312",
        BIG5: "BIG5",
      }

      const targetCharset = charsetMap[normalizedCharset] || charset

      if (iconv.encodingExists(targetCharset)) {
        // For non-UTF8 charsets, we need to work with Buffer
        const buffer = Buffer.from(decoded, "latin1")
        return iconv.decode(buffer, targetCharset)
      }
    } catch (error) {
      console.error(`Failed to decode charset ${charset}:`, error)
    }
  }

  return decoded
}

/**
 * Fix UTF-8 encoding issues where UTF-8 bytes were incorrectly interpreted as Latin-1
 * This happens when UTF-8 encoded text is read as Latin-1/ISO-8859-1
 *
 * Example: "ì í" (wrong) -> "전화" (correct)
 */
export function fixUtf8Encoding(text: string): string {
  if (!text) return text

  try {
    // Look for sequences of Latin-1 extended characters that are common in UTF-8 mojibake
    // Korean UTF-8 bytes (0xEA-0xED range) appear as ê, ë, ì, í when misread as Latin-1
    const hasMojibake = /[ê-í]{2,}|[ë-í][^a-zA-Z0-9\s<>]{1,2}[ê-í]/.test(text)

    if (!hasMojibake) {
      return text
    }

    // Convert string to Latin-1 bytes, then decode as UTF-8
    const bytes: number[] = []
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      // Only convert characters in Latin-1 range (0-255)
      if (code < 256) {
        bytes.push(code)
      } else {
        // If character is already outside Latin-1 range, text is already UTF-8
        return text
      }
    }

    const buffer = Buffer.from(bytes)
    let fixed: string

    try {
      fixed = buffer.toString("utf-8")
    } catch (_e) {
      // If UTF-8 decoding fails, return original
      return text
    }

    // Verify the fix worked by checking if we now have valid Korean/CJK characters
    // and the mojibake pattern is gone
    const hasValidCJK =
      /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf\uac00-\ud7a3]/.test(
        fixed,
      )
    const stillHasMojibake = /[ê-í]{2,}/.test(fixed)

    return hasValidCJK && !stillHasMojibake ? fixed : text
  } catch (error) {
    console.error("Failed to fix UTF-8 encoding:", error)
    return text
  }
}

/**
 * Remove quoted reply content from email body
 * Handles various quote formats:
 * - Lines starting with >
 * - Gmail-style "On ... wrote:" headers
 * - Korean "...님이 작성:" headers
 * - Separator lines (────────)
 *
 * @param text - Plain text email content
 * @returns Text with quoted content removed
 */
export function removeQuotedReply(text: string): string {
  if (!text) return ""

  const lines = text.split(/\r?\n/)
  const cleanedLines: string[] = []
  let inQuote = false

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Check for quote indicators
    if (
      // Standard quote prefix (> or multiple >)
      /^>+\s*/.test(trimmedLine) ||
      // English quote header: "On ... wrote:" or "On ... <email> wrote:"
      /^On\s+.+\s+wrote:$/i.test(trimmedLine) ||
      // Korean quote header: "2025년 10월 27일...님이 작성:"
      /^\d{4}년\s+\d{1,2}월\s+\d{1,2}일.+님이\s+작성:/.test(trimmedLine) ||
      // Korean quote header: "2025년 10월 27일 오후 09:43에...님이 작성:"
      /^\d{4}년\s+\d{1,2}월\s+\d{1,2}일.+에\s+.+님이\s+작성:/.test(trimmedLine) ||
      // Separator line (multiple dashes or underscores)
      /^[─_-]{10,}$/.test(trimmedLine) ||
      // Empty line after quote header (helps catch the quote start)
      (inQuote && trimmedLine === "")
    ) {
      inQuote = true
      continue
    }

    // If we're not in a quote block, add the line
    if (!inQuote) {
      cleanedLines.push(line)
    }
  }

  // Remove trailing empty lines
  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1]?.trim() === "") {
    cleanedLines.pop()
  }

  return cleanedLines.join("\n").trim()
}

/**
 * Parse RFC 822 email content to extract text and HTML parts
 *
 * @param emailContent - Full RFC 822 email content
 * @returns { text: string | undefined, html: string | undefined }
 */
/**
 * Parse multipart email by finding all text/plain and text/html parts
 * Handles nested multipart by extracting all parts regardless of nesting level
 */
function parseMultipartRecursive(
  content: string,
  _boundary: string,
): {
  text: string | undefined
  html: string | undefined
} {
  let text: string | undefined
  let html: string | undefined

  // Find all text/plain parts
  // Pattern: Content-Type: text/plain ... [headers] ... \r\n\r\n [body] \r\n--
  const textPlainRegex = /Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--)/gi
  const textPlainMatches = Array.from(content.matchAll(textPlainRegex))

  for (const match of textPlainMatches) {
    if (!match.index) continue

    // Find the header section (from Content-Type to blank line)
    let headerEndOffset = match[0].indexOf("\r\n\r\n")
    if (headerEndOffset < 0) {
      headerEndOffset = match[0].indexOf("\n\n")
    }
    if (headerEndOffset < 0) continue

    const headers = match[0].substring(0, headerEndOffset)

    // Extract charset and encoding from headers
    const charsetMatch = headers.match(/charset=["']?([^"'\s;]+)["']?/i)
    const charset = charsetMatch?.[1]?.trim()

    const encodingMatch = headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
    const encoding = encodingMatch?.[1]?.trim().toLowerCase()

    // Get body content (capture group 1)
    const bodyContent = match[1]
    if (!bodyContent) continue

    // Remove any trailing boundary markers
    const cleanContent = bodyContent.replace(/\r?\n--[^\r\n]*$/g, "").trim()

    if (cleanContent && !text) {
      text = decodeContent(cleanContent, encoding, charset)
    }
  }

  // Find all text/html parts
  const textHtmlRegex = /Content-Type:\s*text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--)/gi
  const textHtmlMatches = Array.from(content.matchAll(textHtmlRegex))

  for (const match of textHtmlMatches) {
    if (!match.index) continue

    // Find the header section (from Content-Type to blank line)
    let headerEndOffset = match[0].indexOf("\r\n\r\n")
    if (headerEndOffset < 0) {
      headerEndOffset = match[0].indexOf("\n\n")
    }
    if (headerEndOffset < 0) continue

    const headers = match[0].substring(0, headerEndOffset)

    // Extract charset and encoding from headers
    const charsetMatch = headers.match(/charset=["']?([^"'\s;]+)["']?/i)
    const charset = charsetMatch?.[1]?.trim()

    const encodingMatch = headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
    const encoding = encodingMatch?.[1]?.trim().toLowerCase()

    // Get body content (capture group 1)
    const bodyContent = match[1]
    if (!bodyContent) continue

    // Remove any trailing boundary markers
    const cleanContent = bodyContent.replace(/\r?\n--[^\r\n]*$/g, "").trim()

    if (cleanContent && !html) {
      html = decodeContent(cleanContent, encoding, charset)
    }
  }

  return { text, html }
}

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
    // Multipart email - 재귀적으로 파싱
    const result = parseMultipartRecursive(emailContent, boundary)
    text = result.text
    html = result.html
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

    // Extract charset from headers
    const charsetMatch = headersPart.match(/charset=["']?([^"'\s;]+)["']?/i)
    const charset = charsetMatch?.[1]?.trim()

    // Extract encoding from headers
    const encodingMatch = headersPart.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
    const encoding = encodingMatch?.[1]?.trim().toLowerCase()

    // Extract content type
    const contentTypeMatch = headersPart.match(/Content-Type:\s*([^\r\n;]+)/i)
    const contentType = contentTypeMatch?.[1]?.trim().toLowerCase()

    // Decode the body
    const decodedBody = decodeContent(body, encoding, charset)

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

  // Remove quoted reply content from text
  if (text) {
    text = removeQuotedReply(text)
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
 * Parse attachments from raw MIME email content
 * Extracts files with Content-Disposition: attachment or inline
 *
 * @param emailContent - Full RFC 822 email content
 * @returns Array of attachments with filename, type, size, and base64 content
 */
export function parseEmailAttachments(emailContent: string): Array<{
  filename: string
  type: string
  size: number
  content: string // Base64 encoded
}> {
  const attachments: Array<{
    filename: string
    type: string
    size: number
    content: string
  }> = []

  if (!emailContent) {
    return attachments
  }

  // Find boundary for multipart messages
  const boundaryMatch = emailContent.match(/boundary="?([^"\s;]+)"?/i)
  if (!boundaryMatch || !boundaryMatch[1]) {
    return attachments // Not a multipart message, no attachments
  }

  const boundary = boundaryMatch[1]
  // Escape special regex characters in boundary
  const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const boundaryRegex = new RegExp(`--${escapedBoundary}`, "g")

  // Split by boundary
  const parts = emailContent.split(boundaryRegex)

  for (const part of parts) {
    // Skip empty parts and final boundary marker
    const trimmedPart = part.trim()
    if (!trimmedPart || trimmedPart === "--") {
      continue
    }

    // Extract headers and body
    const headerBodySplit = trimmedPart.split(/\r?\n\r?\n/)
    if (headerBodySplit.length < 2 || !headerBodySplit[0]) {
      continue
    }

    const headers = headerBodySplit[0]
    let body = headerBodySplit.slice(1).join("\r\n\r\n").trim()

    // Remove trailing boundary markers and whitespace
    // Body may contain the next boundary marker (--boundary) or final marker (--boundary--)
    body = body.replace(/\r?\n--[^\r\n]*--?\s*$/, "").trim()

    // Check if this part is an attachment
    const dispositionMatch = headers.match(/Content-Disposition:\s*([^\r\n]+)/i)
    if (!dispositionMatch || !dispositionMatch[1]) {
      continue
    }

    const disposition = dispositionMatch[1].toLowerCase()
    const isAttachment = disposition.includes("attachment") || disposition.includes("inline")

    if (!isAttachment) {
      continue
    }

    // Extract filename
    const filenameMatch = headers.match(/filename="?([^"\r\n]+)"?/i)
    let filename: string

    if (filenameMatch?.[1]) {
      filename = filenameMatch[1].trim()
    } else {
      // Try filename* format (RFC 2231)
      const filenameStarMatch = headers.match(/filename\*=\w+'[^']*'([^;\r\n]+)/i)
      if (filenameStarMatch?.[1]) {
        filename = decodeURIComponent(filenameStarMatch[1].trim())
      } else {
        // Try name parameter in Content-Type
        const nameMatch = headers.match(/name="?([^"\r\n]+)"?/i)
        if (nameMatch?.[1]) {
          filename = nameMatch[1].trim()
        } else {
          continue // Skip if no filename
        }
      }
    }

    // Extract content type
    const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n;]+)/i)
    const contentType = contentTypeMatch?.[1]?.trim() || "application/octet-stream"

    // Extract encoding
    const encodingMatch = headers.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
    const encoding = encodingMatch?.[1]?.trim().toLowerCase() || "7bit"

    // Decode body based on encoding
    let decodedBuffer: Buffer

    try {
      if (encoding === "base64") {
        // Remove all whitespace (spaces, tabs, newlines) before decoding base64
        // Base64 should only contain A-Z, a-z, 0-9, +, /, and = padding
        const cleaned = body.replace(/[\s\r\n\t]/g, "")
        decodedBuffer = Buffer.from(cleaned, "base64")
      } else if (encoding === "quoted-printable") {
        // Decode quoted-printable
        const withoutSoftBreaks = body.replace(/=\r?\n/g, "")
        const bytes: number[] = []
        let i = 0
        while (i < withoutSoftBreaks.length) {
          if (withoutSoftBreaks[i] === "=" && i + 2 < withoutSoftBreaks.length) {
            const hex = withoutSoftBreaks.substring(i + 1, i + 3)
            bytes.push(Number.parseInt(hex, 16))
            i += 3
          } else {
            bytes.push(withoutSoftBreaks.charCodeAt(i))
            i++
          }
        }
        decodedBuffer = Buffer.from(bytes)
      } else {
        // 7bit, 8bit - treat as text and convert to buffer
        decodedBuffer = Buffer.from(body, "utf-8")
      }

      // Store as base64 for consistency with multipart file handling
      const base64Content = decodedBuffer.toString("base64")

      attachments.push({
        filename: sanitizeFilename(filename), // Decode RFC 2047 and sanitize
        type: contentType,
        size: decodedBuffer.length,
        content: base64Content,
      })
    } catch (error) {
      console.error(`Failed to parse attachment ${filename}:`, error)
      // Skip this attachment if parsing fails
    }
  }

  return attachments
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
