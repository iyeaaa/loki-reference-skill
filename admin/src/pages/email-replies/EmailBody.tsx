import DOMPurify from "dompurify"
import Encoding from "encoding-japanese"
import quotedPrintable from "quoted-printable"
import { useEffect, useMemo, useRef, useState } from "react"
import utf8 from "utf8"

interface EmailBodyProps {
  bodyText?: string
  bodyHtml?: string
}

/**
 * Remove MIME headers from email body
 * Sometimes email parsing fails and MIME headers are left in the body
 */
function removeMimeHeaders(text: string): string {
  let cleaned = text

  // Remove MIME boundary markers (e.g., --_000_294a2abcd8d1489ebd99f68cb6c2aed4...)
  cleaned = cleaned.replace(/^--[_=][\w-]+$/gm, "")

  // Remove Content-Type headers
  cleaned = cleaned.replace(/^Content-Type:\s*.+$/gim, "")

  // Remove Content-Transfer-Encoding headers
  cleaned = cleaned.replace(/^Content-Transfer-Encoding:\s*.+$/gim, "")

  // Remove Content-ID headers
  cleaned = cleaned.replace(/^Content-ID:\s*.+$/gim, "")

  // Remove Content-Disposition headers
  cleaned = cleaned.replace(/^Content-Disposition:\s*.+$/gim, "")

  // Remove excessive newlines left by header removal
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n")

  // Trim leading/trailing whitespace
  return cleaned.trim()
}

/**
 * Format bracketed content (e.g., [logos], [https://...])
 * This handles cases where HTML images/links are converted to plain text alt text
 */
function formatBracketedContent(text: string): string {
  let formatted = text

  console.log("🔍 Formatting bracketed content, original length:", text.length)

  // Step 0: Convert markdown-style links <https://...> to clickable links
  const markdownUrlPattern = /<(https?:\/\/[^>]+)>/g
  const markdownUrlMatches = text.match(markdownUrlPattern)
  if (markdownUrlMatches) {
    console.log("Found markdown URL brackets:", markdownUrlMatches.length)
    formatted = formatted.replace(
      markdownUrlPattern,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline break-all text-xs">🔗 링크</a>',
    )
  }

  // Step 1: Convert [https://...] or [http://...] to actual clickable links
  const urlPattern = /\[(https?:\/\/[^\]]+)\]/g
  const urlMatches = formatted.match(urlPattern)
  if (urlMatches) {
    console.log("Found URL brackets:", urlMatches.length)
    formatted = formatted.replace(
      urlPattern,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline break-all text-xs">🔗 링크</a>',
    )
  }

  // Step 2: Format image/logo descriptions with an icon
  // Match patterns like [Company logos], [Image description], etc.
  const imagePattern = /\[([^\]]+(?:logo|image|icon|photo|picture|graphic)[^\]]*)\]/gi
  const imageMatches = formatted.match(imagePattern)
  if (imageMatches) {
    console.log("Found image brackets:", imageMatches.length)
    formatted = formatted.replace(
      imagePattern,
      '<div class="inline-block px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 italic my-1">🖼️ 이미지</div>',
    )
  }

  // Step 3: Format social media and other common patterns
  const socialPattern = /\[([^\]]+(?:facebook|instagram|twitter|linkedin|youtube|tiktok)[^\]]*)\]/gi
  const socialMatches = formatted.match(socialPattern)
  if (socialMatches) {
    console.log("Found social media brackets:", socialMatches.length)
    formatted = formatted.replace(
      socialPattern,
      '<span class="inline-block px-1.5 py-0.5 bg-blue-50 rounded text-xs text-blue-700 mx-0.5">📱 소셜미디어</span>',
    )
  }

  // Step 4: Format review/rating related content
  const reviewPattern = /\[([^\]]+(?:review|rating|star|trustpilot)[^\]]*)\]/gi
  const reviewMatches = formatted.match(reviewPattern)
  if (reviewMatches) {
    console.log("Found review brackets:", reviewMatches.length)
    formatted = formatted.replace(
      reviewPattern,
      '<span class="inline-block px-1.5 py-0.5 bg-yellow-50 rounded text-xs text-yellow-700 mx-0.5">⭐ 리뷰</span>',
    )
  }

  // Step 5: Format remaining bracketed content with subtle styling
  const remainingPattern = /\[([^\]]+)\]/g
  const remainingMatches = formatted.match(remainingPattern)
  if (remainingMatches) {
    console.log("Found other brackets:", remainingMatches.length)
    formatted = formatted.replace(
      remainingPattern,
      '<span class="inline-block px-1.5 py-0.5 bg-gray-50 rounded text-xs text-gray-500 mx-0.5">$1</span>',
    )
  }

  console.log("✅ Formatted content length:", formatted.length)

  return formatted
}

/**
 * Decode various email encodings (ISO-2022-JP, Quoted-Printable, etc.)
 * This handles cases where email content is improperly decoded
 */
function decodeEncodedText(text: string): string {
  let decoded = text

  // Step 1: Check for Quoted-Printable encoding (=XX format)
  // Common in Thai, Vietnamese, and other languages
  if (
    text.includes("=E") ||
    text.includes("=D") ||
    text.includes("=C") ||
    /=[0-9A-F]{2}/i.test(text)
  ) {
    try {
      // Decode quoted-printable first
      const qpDecoded = quotedPrintable.decode(text)
      // Try to decode UTF-8, but fall back to original if it fails
      try {
        decoded = utf8.decode(qpDecoded)
        return decoded
      } catch (_utf8Error) {
        console.warn("UTF-8 decode failed, using quoted-printable decoded text directly")
        return qpDecoded
      }
    } catch (e) {
      console.error("Failed to decode Quoted-Printable:", e)
      // Continue to try other decodings
    }
  }

  // Step 2: Check for ISO-2022-JP markers (Japanese)
  if (decoded.includes("$B") || decoded.includes("(B") || decoded.includes("$J")) {
    try {
      // Convert string to array of character codes
      const codes: number[] = []
      for (let i = 0; i < decoded.length; i++) {
        codes.push(decoded.charCodeAt(i))
      }

      // Try to detect and convert from JIS (ISO-2022-JP)
      const detectedEncoding = Encoding.detect(codes)

      if (
        detectedEncoding === "JIS" ||
        detectedEncoding === "EUCJP" ||
        detectedEncoding === "SJIS"
      ) {
        // Convert to Unicode array
        const unicodeArray = Encoding.convert(codes, {
          to: "UNICODE",
          from: detectedEncoding,
        })

        // Convert to string
        decoded = Encoding.codeToString(unicodeArray)
      }
    } catch (e) {
      console.error("Failed to decode ISO-2022-JP:", e)
    }
  }

  // Step 3: Decode HTML entities (&aacute;, &yacute;, &#233;, etc.)
  // This is common in Vietnamese, Spanish, and other languages with accents
  if (decoded.includes("&") && (decoded.includes(";") || decoded.includes("&#"))) {
    try {
      const textarea = document.createElement("textarea")
      textarea.innerHTML = decoded
      decoded = textarea.value
    } catch (e) {
      console.error("Failed to decode HTML entities:", e)
    }
  }

  return decoded
}

/**
 * Email body component - safely displays HTML or text content
 */
export function EmailBody({ bodyText, bodyHtml }: EmailBodyProps) {
  const sanitizedContent = useMemo(() => {
    console.log("📧 EmailBody rendering - bodyHtml:", !!bodyHtml, "bodyText:", !!bodyText)

    // Prefer HTML content if available
    if (bodyHtml) {
      console.log("📧 Processing bodyHtml...")
      // Remove MIME headers if present
      const cleanedHtml = removeMimeHeaders(bodyHtml)
      // Then decode if needed
      const decodedHtml = decodeEncodedText(cleanedHtml)

      // Debug: Log original HTML length
      console.log("Original HTML length:", decodedHtml.length)
      console.log("First 500 chars:", decodedHtml.substring(0, 500))

      // Check if bodyHtml actually contains HTML tags
      // Sometimes bodyHtml contains plain text or markdown format
      // Exclude markdown links like <https://...> from HTML tag detection
      const htmlTagPattern = /<(?!https?:\/\/)[a-z][a-z0-9]*[\s>]/i
      const hasHtmlTags = htmlTagPattern.test(decodedHtml)
      console.log("Has actual HTML tags?", hasHtmlTags)

      if (!hasHtmlTags) {
        console.log("📧 bodyHtml is actually plain text, treating as text")
        // Treat as plain text with bracket formatting
        if (decodedHtml.includes("[") && decodedHtml.includes("]")) {
          console.log("🔍 Plain text has brackets, formatting...")
          // Convert newlines to <br> tags BEFORE formatting brackets
          const withLineBreaks = decodedHtml.replace(/\n/g, "<br>")
          const formatted = formatBracketedContent(withLineBreaks)
          const cleaned = DOMPurify.sanitize(formatted, {
            ALLOWED_TAGS: ["a", "span", "br", "div", "p"],
            ALLOWED_ATTR: ["href", "target", "rel", "class"],
            ALLOW_DATA_ATTR: false,
            ALLOW_UNKNOWN_PROTOCOLS: false,
            KEEP_CONTENT: true,
          })
          console.log("✅ Cleaned formatted HTML length:", cleaned.length)
          return { type: "html" as const, content: cleaned, hasFullHtml: false }
        }
        return { type: "text" as const, content: decodedHtml }
      }

      // Sanitize HTML to prevent XSS attacks
      // Use very permissive settings for email HTML
      const cleaned = DOMPurify.sanitize(decodedHtml, {
        // Allow almost all HTML tags (email templates are complex)
        ALLOWED_TAGS: [
          "html",
          "head",
          "body",
          "title",
          "p",
          "br",
          "strong",
          "b",
          "em",
          "i",
          "u",
          "a",
          "ul",
          "ol",
          "li",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "blockquote",
          "code",
          "pre",
          "div",
          "span",
          "table",
          "thead",
          "tbody",
          "tfoot",
          "tr",
          "th",
          "td",
          "img",
          "hr",
          "font",
          "center",
          "noscript",
          "xml",
          "o:OfficeDocumentSettings",
          "o:AllowPNG",
          "o:PixelsPerInch",
        ],
        // Allow all common HTML attributes
        ALLOWED_ATTR: [
          "href",
          "target",
          "rel",
          "src",
          "alt",
          "title",
          "class",
          "style",
          "width",
          "height",
          "border",
          "cellpadding",
          "cellspacing",
          "align",
          "valign",
          "bgcolor",
          "color",
          "size",
          "face",
          "dir",
          "lang",
          "role",
          "id",
          "name",
          "type",
          "xmlns",
          "xmlns:v",
          "xmlns:o",
          "http-equiv",
          "content",
        ],
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        // Keep content from removed tags
        KEEP_CONTENT: true,
        // Allow style tags for email templates
        ADD_TAGS: ["style", "meta"],
        ADD_ATTR: ["target", "xmlns"],
        // Return DOM instead of string for better handling
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        // More permissive settings - allow full document for email HTML
        WHOLE_DOCUMENT: true,
        FORCE_BODY: true,
      })

      console.log("Cleaned HTML length:", cleaned.length)
      console.log("First 500 chars of cleaned:", cleaned.substring(0, 500))

      // Extract actual text content from HTML to check if there's meaningful content
      const tempDiv = document.createElement("div")
      tempDiv.innerHTML = cleaned
      const textContent = tempDiv.textContent || tempDiv.innerText || ""
      const actualTextLength = textContent.trim().length
      console.log("Actual text content length:", actualTextLength)

      // If cleaned HTML has no meaningful text content, fallback to bodyText
      if (cleaned.length === 0 || actualTextLength < 10) {
        console.log("📧 Cleaned HTML has no meaningful text content, falling back to bodyText")
        if (bodyText) {
          const cleanedText = removeMimeHeaders(bodyText)
          const decoded = decodeEncodedText(cleanedText)
          console.log("📧 Fallback bodyText length:", decoded.length)
          console.log("📧 Fallback bodyText preview:", decoded.substring(0, 200))
          if (decoded.includes("[") && decoded.includes("]")) {
            const withLineBreaks = decoded.replace(/\n/g, "<br>")
            const formatted = formatBracketedContent(withLineBreaks)
            const cleanedFormatted = DOMPurify.sanitize(formatted, {
              ALLOWED_TAGS: ["a", "span", "br", "div", "p"],
              ALLOWED_ATTR: ["href", "target", "rel", "class"],
              ALLOW_DATA_ATTR: false,
              ALLOW_UNKNOWN_PROTOCOLS: false,
              KEEP_CONTENT: true,
            })
            return { type: "html" as const, content: cleanedFormatted, hasFullHtml: false }
          }
          return { type: "text" as const, content: decoded }
        }
      }

      // Check if HTML contains <style> tags (needs iframe isolation)
      const hasStyleTags = /<style[\s>]/i.test(cleaned)
      console.log("Has style tags:", hasStyleTags)

      return { type: "html" as const, content: cleaned, hasFullHtml: hasStyleTags }
    }

    // Fall back to text content
    if (bodyText) {
      console.log("📧 Processing bodyText...")
      // Remove MIME headers if present
      const cleanedText = removeMimeHeaders(bodyText)
      console.log("After MIME cleanup:", cleanedText.substring(0, 200))
      // Then decode if needed
      const decoded = decodeEncodedText(cleanedText)
      console.log("After decoding:", decoded.substring(0, 200))
      console.log("Has brackets?", decoded.includes("[") && decoded.includes("]"))

      // Check if bodyText actually contains HTML
      // (sometimes emails store HTML in bodyText field)
      // Use strict HTML detection to avoid false positives
      // This pattern matches actual HTML tags like <div>, <p>, <br>, etc.
      // but excludes email addresses like <user@domain.com>
      const htmlTagPattern = /<(?!https?:\/\/)(?![^@<>]+@[^@<>]+>)[a-z][a-z0-9]*(?:\s+[^>]*)?>/i
      const hasHtmlTags = htmlTagPattern.test(decoded)
      console.log("Has actual HTML tags?", hasHtmlTags)

      if (hasHtmlTags) {
        console.log("📧 bodyText contains HTML tags, treating as HTML")
        // Debug: Log original text length
        console.log("bodyText contains HTML - length:", decoded.length)
        console.log("First 500 chars:", decoded.substring(0, 500))

        // Sanitize as HTML
        const cleaned = DOMPurify.sanitize(decoded, {
          ALLOWED_TAGS: [
            "html",
            "head",
            "body",
            "title",
            "p",
            "br",
            "strong",
            "b",
            "em",
            "i",
            "u",
            "a",
            "ul",
            "ol",
            "li",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "blockquote",
            "code",
            "pre",
            "div",
            "span",
            "table",
            "thead",
            "tbody",
            "tfoot",
            "tr",
            "th",
            "td",
            "img",
            "hr",
            "font",
            "center",
            "noscript",
            "xml",
            "o:OfficeDocumentSettings",
            "o:AllowPNG",
            "o:PixelsPerInch",
          ],
          ALLOWED_ATTR: [
            "href",
            "target",
            "rel",
            "src",
            "alt",
            "title",
            "class",
            "style",
            "width",
            "height",
            "border",
            "cellpadding",
            "cellspacing",
            "align",
            "valign",
            "bgcolor",
            "color",
            "size",
            "face",
            "dir",
            "lang",
            "role",
            "id",
            "name",
            "type",
            "xmlns",
            "xmlns:v",
            "xmlns:o",
            "http-equiv",
            "content",
          ],
          ALLOW_DATA_ATTR: false,
          ALLOW_UNKNOWN_PROTOCOLS: false,
          KEEP_CONTENT: true,
          ADD_TAGS: ["style", "meta"],
          ADD_ATTR: ["target", "xmlns"],
          RETURN_DOM: false,
          RETURN_DOM_FRAGMENT: false,
          WHOLE_DOCUMENT: true,
          FORCE_BODY: true,
        })

        console.log("Cleaned bodyText HTML length:", cleaned.length)
        console.log("First 500 chars of cleaned:", cleaned.substring(0, 500))

        // If cleaned HTML is empty, fallback to plain text rendering
        if (cleaned.length === 0) {
          console.log("📧 Cleaned bodyText HTML is empty, falling back to plain text")
          if (decoded.includes("[") && decoded.includes("]")) {
            const withLineBreaks = decoded.replace(/\n/g, "<br>")
            const formatted = formatBracketedContent(withLineBreaks)
            const cleanedFormatted = DOMPurify.sanitize(formatted, {
              ALLOWED_TAGS: ["a", "span", "br", "div", "p"],
              ALLOWED_ATTR: ["href", "target", "rel", "class"],
              ALLOW_DATA_ATTR: false,
              ALLOW_UNKNOWN_PROTOCOLS: false,
              KEEP_CONTENT: true,
            })
            return { type: "html" as const, content: cleanedFormatted, hasFullHtml: false }
          }
          return { type: "text" as const, content: decoded }
        }

        // Check if HTML contains <style> tags (needs iframe isolation)
        const hasStyleTagsInBodyText = /<style[\s>]/i.test(cleaned)
        return { type: "html" as const, content: cleaned, hasFullHtml: hasStyleTagsInBodyText }
      }

      // Plain text - check if it has bracketed content to format
      if (decoded.includes("[") && decoded.includes("]")) {
        console.log("🔍 Plain text has brackets, formatting...")
        // Convert newlines to <br> tags BEFORE formatting brackets
        const withLineBreaks = decoded.replace(/\n/g, "<br>")
        const formatted = formatBracketedContent(withLineBreaks)
        // Sanitize the formatted HTML
        const cleaned = DOMPurify.sanitize(formatted, {
          ALLOWED_TAGS: ["a", "span", "br", "div", "p"],
          ALLOWED_ATTR: ["href", "target", "rel", "class"],
          ALLOW_DATA_ATTR: false,
          ALLOW_UNKNOWN_PROTOCOLS: false,
          KEEP_CONTENT: true,
        })
        console.log("✅ Cleaned formatted HTML length:", cleaned.length)
        return { type: "html" as const, content: cleaned, hasFullHtml: false }
      }

      return { type: "text" as const, content: decoded }
    }

    return { type: "empty" as const, content: "" }
  }, [bodyHtml, bodyText])

  // State for iframe height auto-adjustment
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(200)

  // Adjust iframe height based on content
  useEffect(() => {
    if (sanitizedContent.type !== "html" || !sanitizedContent.hasFullHtml) {
      return
    }

    const iframe = iframeRef.current
    if (!iframe) return

    const adjustHeight = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document
        if (doc?.body) {
          const height = doc.body.scrollHeight
          if (height > 0) {
            setIframeHeight(Math.min(height + 20, 2000)) // Max 2000px
          }
        }
      } catch (_e) {
        // Cross-origin errors are expected, ignore
      }
    }

    // Adjust after initial load
    iframe.onload = adjustHeight

    // Also try after a short delay for slow-loading content
    const timeout = setTimeout(adjustHeight, 500)
    return () => clearTimeout(timeout)
  }, [sanitizedContent])

  if (sanitizedContent.type === "empty") {
    return <div className="text-muted-foreground italic">(내용 없음)</div>
  }

  if (sanitizedContent.type === "html") {
    // For full HTML documents with <style> tags, use iframe to isolate styles
    if (sanitizedContent.hasFullHtml) {
      return (
        <iframe
          ref={iframeRef}
          srcDoc={sanitizedContent.content}
          title="Email content"
          className="w-full border-0"
          style={{ height: `${iframeHeight}px`, minHeight: "200px" }}
          sandbox="allow-same-origin"
        />
      )
    }

    // For simple HTML without <style> tags, use dangerouslySetInnerHTML
    return (
      <div
        className="prose prose-sm max-w-none break-words [&_img]:max-w-full [&_img]:h-auto [&_a]:text-blue-600 [&_a]:underline"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized with DOMPurify
        dangerouslySetInnerHTML={{ __html: sanitizedContent.content }}
      />
    )
  }

  // Plain text - convert newlines to <br> for better rendering
  // Use whitespace-pre-wrap to preserve spacing and line breaks
  return (
    <div className="whitespace-pre-wrap break-words leading-relaxed">
      {sanitizedContent.content}
    </div>
  )
}
