import { marked } from "marked"

/**
 * Markdown 텍스트를 HTML로 변환
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || markdown.trim() === "") {
    return ""
  }

  try {
    // marked 설정
    marked.setOptions({
      breaks: true, // 줄바꿈을 <br>로 변환
      gfm: true, // GitHub Flavored Markdown 지원
    })

    return marked(markdown) as string
  } catch (error) {
    console.error("Markdown to HTML conversion error:", error)
    // 변환 실패 시 원본 텍스트를 HTML로 이스케이프하여 반환
    return markdown
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/\n/g, "<br>")
  }
}

/**
 * HTML을 Markdown으로 변환 (기본적인 변환)
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html.trim() === "") {
    return ""
  }

  try {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<p>/gi, "")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<strong>/gi, "**")
      .replace(/<\/strong>/gi, "**")
      .replace(/<em>/gi, "*")
      .replace(/<\/em>/gi, "*")
      .replace(/<h1>/gi, "# ")
      .replace(/<\/h1>/gi, "\n")
      .replace(/<h2>/gi, "## ")
      .replace(/<\/h2>/gi, "\n")
      .replace(/<h3>/gi, "### ")
      .replace(/<\/h3>/gi, "\n")
      .replace(/<ul>/gi, "")
      .replace(/<\/ul>/gi, "\n")
      .replace(/<li>/gi, "- ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]*>/g, "") // 나머지 HTML 태그 제거
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  } catch (error) {
    console.error("HTML to Markdown conversion error:", error)
    return html
  }
}
