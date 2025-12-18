/**
 * FitScore Web Worker
 * 메인 스레드 UI 블로킹을 방지하기 위해 백그라운드에서 적합도 점수 계산
 */

type WebsiteAnalysis = {
  companyName?: string
  industry?: string
  targetAudiences?: string[]
  expansionGoals?: string[]
  competitiveAdvantages?: string[]
  businessModel?: string
}

type LeadForScoring = {
  id: string
  company_name?: string
  web_address?: string
  industry?: string
  country?: string
  description?: string
}

type IncomingMessage = {
  type: "start"
  payload: {
    baseUrl: string
    leads: LeadForScoring[]
    websiteAnalysis: WebsiteAnalysis
    selectedTarget: { country: string; industry: string }
    userQuery?: string
    workspaceId?: string
  }
}

type OutgoingMessage =
  | { type: "score"; leadId: string; score: number; reason?: string; progress: number }
  | { type: "complete"; totalProcessed: number }
  | { type: "error"; error: string }

// SSE 청크 파싱
function parseSSEChunk(chunk: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = []
  const lines = chunk.split("\n")

  let currentEvent = ""
  let currentData = ""

  for (const line of lines) {
    if (line.startsWith("event:")) {
      currentEvent = line.slice(6).trim()
    } else if (line.startsWith("data:")) {
      currentData = line.slice(5).trim()
    } else if (line === "" && currentEvent && currentData) {
      try {
        events.push({ event: currentEvent, data: JSON.parse(currentData) })
      } catch {
        // JSON 파싱 실패 무시
      }
      currentEvent = ""
      currentData = ""
    }
  }

  return events
}

self.onmessage = async (event: MessageEvent<IncomingMessage>) => {
  const { type, payload } = event.data

  if (type !== "start") {
    return
  }

  const { baseUrl, leads, websiteAnalysis, selectedTarget, userQuery, workspaceId } = payload
  const url = `${baseUrl}/api/v1/lead-discovery/score`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        leads,
        websiteAnalysis,
        selectedTarget,
        userQuery,
        workspaceId,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("스트림을 읽을 수 없습니다")
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // SSE 이벤트 파싱
      const lastDoubleNewline = buffer.lastIndexOf("\n\n")
      if (lastDoubleNewline !== -1) {
        const completeChunks = buffer.substring(0, lastDoubleNewline + 2)
        buffer = buffer.substring(lastDoubleNewline + 2)

        const events = parseSSEChunk(completeChunks)
        for (const { event, data } of events) {
          const eventData = data as Record<string, unknown>

          switch (event) {
            case "score":
              self.postMessage({
                type: "score",
                leadId: eventData.leadId as string,
                score: eventData.score as number,
                progress: eventData.progress as number,
              } satisfies OutgoingMessage)
              break
            case "complete":
              self.postMessage({
                type: "complete",
                totalProcessed: eventData.totalProcessed as number,
              } satisfies OutgoingMessage)
              break
            case "error":
              self.postMessage({
                type: "error",
                error: eventData.error as string,
              } satisfies OutgoingMessage)
              break
          }
        }
      }
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "적합도 계산 실패",
    } satisfies OutgoingMessage)
  }
}
