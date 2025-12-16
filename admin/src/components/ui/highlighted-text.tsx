import { Fragment } from "react"

type HighlightedTextProps = {
  text: string
  searchTerm?: string
  className?: string
}

/**
 * Component that highlights search terms within text
 * Supports Korean and English text highlighting
 */
export function HighlightedText({ text, searchTerm, className }: HighlightedTextProps) {
  if (!(searchTerm && text)) {
    return <span className={className}>{text}</span>
  }

  // Escape special regex characters
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  try {
    // Create case-insensitive regex for highlighting
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, "gi")
    const parts = text.split(regex)

    return (
      <span className={className}>
        {parts.map((part, index) => {
          // Check if this part matches the search term (case-insensitive)
          const isMatch = part.toLowerCase() === searchTerm.toLowerCase()

          return (
            <Fragment key={index}>
              {isMatch ? (
                <mark className="rounded bg-yellow-200 px-0.5 font-medium dark:bg-yellow-900">
                  {part}
                </mark>
              ) : (
                part
              )}
            </Fragment>
          )
        })}
      </span>
    )
  } catch (_error) {
    // If regex fails, return original text
    return <span className={className}>{text}</span>
  }
}

/**
 * Utility function to extract plain text from HTML
 */
export function stripHtml(html: string): string {
  const tmp = document.createElement("DIV")
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ""
}

/**
 * Utility function to truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}...`
}
