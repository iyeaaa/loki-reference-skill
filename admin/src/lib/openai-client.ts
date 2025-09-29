import { API_BASE_URL } from "@/lib/api/client"

export interface Lead {
  id: string
  company: string
  description?: string
  industryType?: string
  productCategory?: string
  country?: string
  website?: string
}

export async function generateEmailDraft(
  prompt: string
): Promise<{ subject: string; body: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/email-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromEmail: "admin@partners.grinda.ai",
        subject: "",
        content: prompt,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`API 오류: ${errorData.error || response.statusText}`)
    }

    const result = await response.json()
    // Elysia 공용 래퍼 처리
    const data =
      result && typeof result === "object" && "success" in result && result.success
        ? result.data
        : result

    return {
      subject: data.subject || "제목 없음",
      body: data.body || "본문 없음",
    }
  } catch (error) {
    console.error("이메일 초안 생성 오류:", error)
    throw error
  }
}

// Build a well-formed prompt from a Lead
export function buildDraftPrompt(lead: Lead): string {
  let prompt = `${lead.company} 회사에 보내는 제품 소개 이메일을 작성해주세요.`

  if (lead.description) {
    prompt += ` 회사 설명: ${lead.description}`
  }

  if (lead.industryType) {
    prompt += ` 산업: ${lead.industryType}`
    if (lead.productCategory) {
      prompt += ` (${lead.productCategory})`
    }
  }

  if (lead.country) {
    prompt += ` 국가: ${lead.country}`
  }

  if (lead.website) {
    prompt += ` 웹사이트: ${lead.website}`
  }

  prompt +=
    " 제목과 본문을 모두 한국어로, 정중하고 간결한 톤으로 작성해 주세요. 제목은 60자 이하로 해주세요."

  return prompt
}

export type LeadEmailDraft = { leadId: string; subject: string; body: string }

// Generate an email draft for a single lead via the server API (which internally uses OpenAI)
export async function generateEmailDraftForLead(lead: Lead): Promise<LeadEmailDraft> {
  const { subject, body } = await generateEmailDraft(buildDraftPrompt(lead))
  return { leadId: lead.id, subject, body }
}

// Sequentially generate email drafts for a list of leads with light pacing
export async function generateEmailDraftsForLeads(
  leads: Lead[],
  onProgress?: (p: { index: number; total: number; leadId: string }) => void
): Promise<LeadEmailDraft[]> {
  const results: LeadEmailDraft[] = []
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const res = await generateEmailDraftForLead(lead)
    results.push(res)
    if (onProgress) onProgress({ index: i + 1, total: leads.length, leadId: lead.id })
    // small delay to avoid hammering the API
    await new Promise((r) => setTimeout(r, 150))
  }
  return results
}
