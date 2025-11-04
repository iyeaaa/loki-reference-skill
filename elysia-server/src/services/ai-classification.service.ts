import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import logger from "../utils/logger"

export interface ClassificationResult {
  intent:
    | "meeting_request"
    | "question"
    | "objection"
    | "out_of_office"
    | "not_interested"
    | "positive_interest"
    | "neutral"
  sentiment: "positive" | "neutral" | "negative" | "interested" | "not_interested"
  confidence: number
  reasoning?: string
}

interface ClassifyEmailOptions {
  subject: string
  body: string
  model?: string
  temperature?: number
}

class AIClassificationService {
  private openai: ReturnType<typeof createOpenAI>
  private defaultModel: string

  constructor(apiKey: string, defaultModel = "gpt-4o-mini") {
    this.openai = createOpenAI({
      apiKey: apiKey,
    })
    this.defaultModel = defaultModel
  }

  /**
   * Classify an email reply with intent and sentiment analysis
   */
  async classifyReply(options: ClassifyEmailOptions): Promise<ClassificationResult> {
    const { subject, body, model = this.defaultModel, temperature = 0.3 } = options

    try {
      logger.info({
        msg: "AI classification started",
        subject,
        bodyLength: body.length,
        model,
      })

      const prompt = this.buildClassificationPrompt(subject, body)

      const { text } = await generateText({
        model: this.openai(model),
        prompt,
        temperature,
      })

      const result = this.parseClassificationResult(text)

      logger.info({
        msg: "AI classification completed",
        intent: result.intent,
        sentiment: result.sentiment,
        confidence: result.confidence,
      })

      return result
    } catch (error) {
      logger.error({
        msg: "AI classification failed",
        error: error instanceof Error ? error.message : String(error),
        subject,
      })

      // Return neutral classification on error
      return {
        intent: "neutral",
        sentiment: "neutral",
        confidence: 0,
        reasoning: "Classification failed",
      }
    }
  }

  /**
   * Build the classification prompt
   */
  private buildClassificationPrompt(subject: string, body: string): string {
    return `You are an expert email classifier for B2B sales communication. Analyze the following email reply and classify it into one of the predefined categories.

EMAIL SUBJECT: ${subject}

EMAIL BODY:
${body}

---

Classify this email reply into the following categories:

**INTENT CATEGORIES:**
1. meeting_request - The recipient wants to schedule a meeting, call, or demo
2. question - The recipient has questions about the product, service, or proposal
3. objection - The recipient has concerns, objections, or needs clarification
4. out_of_office - Automated out-of-office or vacation reply
5. not_interested - The recipient explicitly declines or shows no interest
6. positive_interest - The recipient shows positive interest or enthusiasm
7. neutral - General acknowledgment, polite response, or unclear intent

**SENTIMENT CATEGORIES:**
1. positive - Enthusiastic, friendly, or positive tone
2. interested - Shows curiosity or willingness to learn more
3. neutral - Professional but non-committal
4. not_interested - Polite decline or lack of interest
5. negative - Frustrated, annoyed, or negative tone

Respond ONLY with a JSON object in this exact format:
{
  "intent": "<one of the intent categories>",
  "sentiment": "<one of the sentiment categories>",
  "confidence": <number between 0 and 1>,
  "reasoning": "<brief explanation in 1-2 sentences>"
}

Do not include any other text, just the JSON object.`
  }

  /**
   * Parse the AI response into a structured result
   */
  private parseClassificationResult(text: string): ClassificationResult {
    try {
      // Remove markdown code blocks if present
      const cleanedText = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim()

      const parsed = JSON.parse(cleanedText)

      // Validate intent
      const validIntents = [
        "meeting_request",
        "question",
        "objection",
        "out_of_office",
        "not_interested",
        "positive_interest",
        "neutral",
      ]
      const intent = validIntents.includes(parsed.intent) ? parsed.intent : "neutral"

      // Validate sentiment
      const validSentiments = ["positive", "neutral", "negative", "interested", "not_interested"]
      const sentiment = validSentiments.includes(parsed.sentiment) ? parsed.sentiment : "neutral"

      // Validate confidence
      const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0))

      return {
        intent,
        sentiment,
        confidence,
        reasoning: parsed.reasoning || "",
      }
    } catch (error) {
      logger.error({
        msg: "Failed to parse AI classification result",
        error: error instanceof Error ? error.message : String(error),
        rawText: text,
      })

      return {
        intent: "neutral",
        sentiment: "neutral",
        confidence: 0,
        reasoning: "Failed to parse classification",
      }
    }
  }

  /**
   * Batch classify multiple emails
   */
  async classifyBatch(
    emails: Array<{ subject: string; body: string }>,
  ): Promise<ClassificationResult[]> {
    logger.info({
      msg: "Batch classification started",
      count: emails.length,
    })

    const results = await Promise.all(
      emails.map((email) =>
        this.classifyReply(email).catch((error) => {
          logger.error({
            msg: "Batch classification item failed",
            error: error instanceof Error ? error.message : String(error),
            subject: email.subject,
          })
          return {
            intent: "neutral" as const,
            sentiment: "neutral" as const,
            confidence: 0,
            reasoning: "Classification failed",
          }
        }),
      ),
    )

    logger.info({
      msg: "Batch classification completed",
      successCount: results.filter((r) => r.confidence > 0).length,
      failureCount: results.filter((r) => r.confidence === 0).length,
    })

    return results
  }
}

// Singleton instance
let aiClassificationService: AIClassificationService | null = null

export function getAIClassificationService(): AIClassificationService {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set")
  }

  if (!aiClassificationService) {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini"
    aiClassificationService = new AIClassificationService(apiKey, model)
    logger.info({
      msg: "AI Classification Service initialized",
      model,
    })
  }

  return aiClassificationService
}

export default AIClassificationService
