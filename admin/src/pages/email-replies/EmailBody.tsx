import DOMPurify from "dompurify"

interface EmailBodyProps {
  bodyText?: string
  bodyHtml?: string
}

/**
 * Email body component - displays HTML content safely or plain text
 */
export function EmailBody({ bodyText, bodyHtml }: EmailBodyProps) {
  // HTML이 있으면 HTML을 렌더링, 없으면 텍스트 사용
  if (bodyHtml) {
    // DOMPurify로 HTML을 정화해서 XSS 공격 방지
    const sanitizedHtml = DOMPurify.sanitize(bodyHtml, {
      ALLOWED_TAGS: [
        "p",
        "br",
        "div",
        "span",
        "a",
        "img",
        "ul",
        "ol",
        "li",
        "strong",
        "em",
        "b",
        "i",
        "u",
        "blockquote",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "font",
        "table",
        "tr",
        "td",
        "th",
        "tbody",
        "thead",
      ],
      ALLOWED_ATTR: [
        "href",
        "src",
        "alt",
        "title",
        "width",
        "height",
        "class",
        "style",
        "dir",
        "face",
        "size",
        "color",
        "target",
        "rel",
      ],
    })

    if (!sanitizedHtml.trim()) {
      return <div className="text-muted-foreground italic">(내용 없음)</div>
    }

    return (
      <div
        className="prose prose-sm max-w-none break-words"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: DOMPurify로 정화된 HTML을 렌더링하기 위해 필요
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    )
  }

  // HTML이 없으면 텍스트 사용
  if (bodyText?.trim()) {
    return <div className="whitespace-pre-wrap break-words">{bodyText}</div>
  }

  return <div className="text-muted-foreground italic">(내용 없음)</div>
}
