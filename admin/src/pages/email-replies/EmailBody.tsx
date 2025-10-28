interface EmailBodyProps {
  bodyText?: string
  bodyHtml?: string
}

/**
 * Email body component - displays content as-is
 */
export function EmailBody({ bodyText, bodyHtml }: EmailBodyProps) {
  const content = bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]*>/g, "").trim() : "")

  if (!content) {
    return <div className="text-muted-foreground italic">(내용 없음)</div>
  }

  return <div className="whitespace-pre-wrap break-words">{content}</div>
}
