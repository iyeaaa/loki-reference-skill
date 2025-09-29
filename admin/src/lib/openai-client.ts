import { API_BASE_URL } from "@/lib/api/client"

export async function generateEmailDraft(
  prompt: string,
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


