/**
 * Website Analyzer Node
 * Crawls and analyzes company website to extract business information
 */

import { ChatOpenAI } from "@langchain/openai"
import { fetchWithDepth } from "../../web-extraction.service"
import { leadDiscoveryLogger } from "../logger"
import type { LeadDiscoveryState, WebsiteAnalysis } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.3,
})

// Extract structured analysis from website content
async function extractAnalysis(content: string, websiteUrl: string): Promise<WebsiteAnalysis> {
  const prompt = `Analyze the following website content and extract structured business information.

Website URL: ${websiteUrl}
Content:
${content.substring(0, 20000)}

Extract the following information in JSON format:
{
  "companyName": "Company name",
  "description": "Brief description of what the company does (2-3 sentences)",
  "industry": "Primary industry (e.g., Software, Healthcare, Manufacturing)",
  "products": ["List of main products or services"],
  "targetMarkets": ["Target markets or customer segments"],
  "businessModel": "B2B, B2C, B2B2C, etc.",
  "strengths": ["Key competitive advantages or unique selling points"]
}

Rules:
- Only include information you can confidently extract
- Use null for fields you cannot determine
- Keep descriptions concise
- Respond with JSON only, no markdown

JSON:`

  const response = await llm.invoke(prompt)
  const responseText = (response.content as string).trim()

  // Parse JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      companyName: parsed.companyName || undefined,
      description: parsed.description || undefined,
      industry: parsed.industry || undefined,
      products: parsed.products || undefined,
      targetMarkets: parsed.targetMarkets || undefined,
      businessModel: parsed.businessModel || undefined,
      strengths: parsed.strengths || undefined,
      rawContent: content.substring(0, 5000), // Store truncated raw content
    }
  }

  return {
    rawContent: content.substring(0, 5000),
  }
}

export async function analyzeWebsite(
  state: LeadDiscoveryState,
): Promise<Partial<LeadDiscoveryState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  const websiteUrl = state.websiteUrl

  if (!websiteUrl) {
    leadDiscoveryLogger.nodeError("analyzeWebsite", "No website URL provided", 0)
    return {
      error: "Website URL is required for analysis",
      analysisProgress: 0,
      analysisStatus: "Error: No URL provided",
    }
  }

  leadDiscoveryLogger.nodeStart("analyzeWebsite", { websiteUrl })
  leadDiscoveryLogger.websiteAnalysisStart(websiteUrl)

  if (emitter) {
    emitter.nodeStart("analyzeWebsite", "Crawling website...")
  }

  try {
    // Progress callback for real-time updates
    const onProgress = (message: string) => {
      leadDiscoveryLogger.debug(`Progress: ${message}`)
      if (emitter) {
        emitter.progress("analyzeWebsite", message)
      }
    }

    // Page found callback
    const onPageFound = (info: { url: string; title?: string; contentLength: number }) => {
      leadDiscoveryLogger.debug(`Page found: ${info.url} (${info.contentLength} chars)`)
      if (emitter) {
        emitter.progress("analyzeWebsite", `Found: ${info.title || info.url}`, undefined, {
          url: info.url,
          contentLength: info.contentLength,
        })
      }
    }

    // Step 1: Crawl website (10%)
    leadDiscoveryLogger.websiteAnalysisProgress("Crawling website", 10)
    if (emitter) {
      emitter.progress("analyzeWebsite", "Connecting to website...", 10)
    }

    const { pagesContent, httpStatus } = await fetchWithDepth(
      websiteUrl,
      1, // depth = 1 (main + contact/about pages)
      30, // timeout 30 seconds
      onPageFound,
      onProgress,
    )

    if (pagesContent.size === 0) {
      const duration = Date.now() - startTime
      leadDiscoveryLogger.nodeError(
        "analyzeWebsite",
        `Failed to fetch: HTTP ${httpStatus}`,
        duration,
      )
      return {
        error: `Failed to fetch website content (HTTP ${httpStatus})`,
        analysisProgress: 0,
        analysisStatus: "Error: Could not access website",
      }
    }

    // Step 2: Combine content (30%)
    leadDiscoveryLogger.websiteAnalysisProgress("Processing content", 30)
    if (emitter) {
      emitter.progress("analyzeWebsite", `Processing ${pagesContent.size} pages...`, 30)
    }

    const combinedContent = Array.from(pagesContent.values()).join("\n\n---PAGE BREAK---\n\n")

    // Step 3: Extract analysis with LLM (50%)
    leadDiscoveryLogger.websiteAnalysisProgress("Analyzing with AI", 50)
    if (emitter) {
      emitter.progress("analyzeWebsite", "Analyzing content with AI...", 50)
    }

    const analysis = await extractAnalysis(combinedContent, websiteUrl)

    // Step 4: Complete (100%)
    const duration = Date.now() - startTime
    leadDiscoveryLogger.websiteAnalysisProgress("Analysis complete", 100)
    leadDiscoveryLogger.websiteAnalysisComplete(websiteUrl, duration, analysis.companyName)

    if (emitter) {
      emitter.nodeComplete("analyzeWebsite", "Website analysis complete", {
        companyName: analysis.companyName,
        industry: analysis.industry,
        pageCount: pagesContent.size,
      })
    }

    leadDiscoveryLogger.nodeSuccess("analyzeWebsite", duration, {
      companyName: analysis.companyName || "Unknown",
      industry: analysis.industry || "Unknown",
      pagesCrawled: pagesContent.size,
    })

    return {
      websiteAnalysis: analysis,
      analysisProgress: 100,
      analysisStatus: `Analysis complete: ${analysis.companyName || "Company analyzed"}`,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    leadDiscoveryLogger.nodeError("analyzeWebsite", errorMessage, duration)

    if (emitter) {
      emitter.error("analyzeWebsite", errorMessage)
    }

    return {
      error: `Website analysis failed: ${errorMessage}`,
      analysisProgress: 0,
      analysisStatus: `Error: ${errorMessage}`,
    }
  }
}
