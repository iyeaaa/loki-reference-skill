/**
 * Prepare LLM prompt with web content and query
 * Pure function - Core layer
 *
 * @param content - Content fetched from web reader
 * @param query - User's query or question
 * @param url - Source URL (for context)
 * @returns Formatted prompt for LLM
 */
export function prepareLLMPrompt(content: string, query: string, url: string): string {
  return `You are a helpful assistant that answers questions based on web content.

Source URL: ${url}

Content:
${content}

User Query:
${query}

Instructions:
1. Provide a concise, accurate answer to the user's query based solely on the content provided above.
2. If the content doesn't contain the full answer but mentions related links, pages, or sections where the answer might be found, suggest those links or sections.
3. Look for anchor links (href="#..."), internal page links, or references to other pages that might contain the answer.
4. When suggesting links, convert them to absolute URLs:
   - Relative links like "/about" should become "${new URL(url).origin}/about"
   - Anchor links like "#section" should become "${url}#section"
   - Absolute links should be kept as-is
5. If no relevant information is found at all, state that clearly.

Format your response as:
- Direct answer if available
- "For more details, check: [absolute URL]" if partial information is available
- "Information not found in this page" if completely unavailable

Example: If the source is "https://example.com/page" and you find a link "/contact", format it as "https://example.com/contact"`
}

/**
 * Truncate content if it exceeds maximum length
 * Pure function - Core layer
 *
 * @param content - Content to truncate
 * @param maxLength - Maximum length (default: 50000 characters)
 * @returns Truncated content with note if truncated
 */
export function truncateContent(content: string, maxLength = 50000): string {
  if (content.length <= maxLength) {
    return content
  }

  const truncated = content.slice(0, maxLength)
  return `${truncated}\n\n[Content truncated - original length: ${content.length} characters]`
}
