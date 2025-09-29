export async function generateEmailDraft(
  prompt: string,
): Promise<{ subject: string; body: string }> {
  try {
    const response = await fetch("/api/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API 오류: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    return {
      subject: data.subject || "제목 없음",
      body: data.body || "본문 없음",
    };
  } catch (error) {
    console.error("이메일 초안 생성 오류:", error);
    throw error;
  }
}


