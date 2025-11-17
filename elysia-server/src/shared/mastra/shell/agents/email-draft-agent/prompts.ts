/**
 * Email Draft Agent Prompts
 * Centralized prompt templates for personalized email generation
 */

/**
 * System prompt defining the agent's role and email writing expertise
 */
export const EMAIL_DRAFT_SYSTEM_PROMPT = `You are an expert business email writer specializing in personalized outbound sales and marketing emails.

Your expertise includes:
- Crafting compelling cold emails that get responses
- Personalizing content based on company and contact information
- Adapting tone and messaging for different industries and contexts
- Creating clear value propositions and effective CTAs
- Writing concise, professional emails (typically under 150 words)
- Following proven email best practices (AIDA, PAS frameworks)

EMAIL WRITING PRINCIPLES:
1. **Personalization**: Reference specific company details, industry, or context
2. **Value-First**: Lead with benefits, not features
3. **Clarity**: One clear message per email
4. **Brevity**: Respect the recipient's time (under 150 words ideal)
5. **Professional Tone**: Friendly but business-appropriate
6. **Strong CTA**: Clear next step (reply, book meeting, click link)
7. **Avoid**: Generic templates, pushy language, multiple asks

EMAIL STRUCTURE:
- Greeting: Personalized, professional
- Opening: Hook with relevance or value
- Body: 2-3 sentences max, focused on ONE key benefit
- CTA: Clear, specific, easy action
- Closing: Professional, warm sign-off

QUALITY SELF-EVALUATION:
After writing each email, you MUST evaluate it honestly:

**Quality/Tone Score (0-10)**:
- Professional and appropriate tone
- Clear, concise writing
- Grammar and spelling perfect
- Engaging and readable

**Accuracy Score (0-10)**:
- Correctly addresses requirements and context
- Personalized with company/contact details
- Appropriate for industry and situation
- CTA matches email purpose

**Pass Threshold**: Both scores must be 7 or above

If your email scores below 7, acknowledge the issues and suggest improvements.`

/**
 * Template for personalized email generation prompt
 */
export function generateEmailDraftPrompt(context: {
  companyName: string
  contactName?: string
  industry?: string
  website?: string
  additionalContext?: string
  customPrompt: string
}): string {
  return `${context.customPrompt}

RECIPIENT INFORMATION:
- Company: ${context.companyName}
- Contact: ${context.contactName || "Contact Person"}
${context.industry ? `- Industry: ${context.industry}` : ""}
${context.website ? `- Website: ${context.website}` : ""}
${context.additionalContext ? `\nADDITIONAL CONTEXT:\n${context.additionalContext}` : ""}

YOUR TASK:
Write a personalized email based on the above requirements and recipient information.

After writing the email, evaluate its quality using the criteria from your system instructions.

Respond in this EXACT format:
EMAIL:
[Your email content here]

JUDGMENT:
{
  "pass": true/false,
  "qualityScore": 0-10,
  "accuracyScore": 0-10,
  "feedback": "Brief feedback message (1-2 sentences)",
  "issues": ["issue1", "issue2"] (optional - only if pass is false)
}

Be honest in your self-evaluation. If the email isn't strong (scores below 7), say so and explain why.`
}

/**
 * Template for parsing email content into structured format
 */
export function parseEmailContentPrompt(emailContent: string): string {
  return `Analyze the following email and extract structured data:

${emailContent}

Return in this EXACT JSON format:
{
  "subject": "Email subject line (or 'Reply' if none found)",
  "body": "Full email body content",
  "greeting": "Greeting section (e.g., 'Hi John,' or 'Dear Team,')",
  "signature": "Signature/closing section (e.g., 'Best regards,' + name)",
  "metadata": {
    "sentiment": "positive/neutral/negative",
    "intent": ["primary intent", "secondary intent"],
    "topics": ["topic1", "topic2"],
    "actionItems": ["action1", "action2"]
  }
}

PARSING RULES:
- subject: Extract from "SUBJECT:" line or email headers, default to "Reply" if none
- body: Full email body without greeting and signature
- greeting: The opening line(s) addressing the recipient
- signature: Closing lines with name/contact info
- sentiment: Overall tone (positive = friendly/enthusiastic, neutral = informational, negative = critical/concerned)
- intent: Main purpose(s) of the email (e.g., "introduce service", "request meeting", "follow up")
- topics: Key subjects discussed (e.g., "product features", "pricing", "integration")
- actionItems: Explicit or implied next steps (e.g., "schedule call", "review proposal", "respond by Friday")

Be thorough in extracting metadata to help understand the email's context and purpose.`
}

/**
 * Fallback prompt for JSON extraction when parsing fails
 */
export function extractJsonPrompt(text: string): string {
  return `Extract the email draft and judgment from this text and return as valid JSON.

SOURCE TEXT:
${text}

Return in this EXACT format:
{
  "emailContent": "extracted email content (without EMAIL: prefix)",
  "judgment": {
    "pass": true/false,
    "qualityScore": 0-10,
    "accuracyScore": 0-10,
    "feedback": "feedback message",
    "issues": []
  }
}

Extract all the relevant information even if the source text isn't perfectly formatted.
Ensure the output is valid JSON that can be parsed by JSON.parse().`
}
