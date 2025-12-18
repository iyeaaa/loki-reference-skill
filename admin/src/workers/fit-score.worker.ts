type LeadForScoring = {
  id: string
  company_name?: string
  email?: string
  phone?: string
  web_address?: string
  description?: string
  company_type?: string
  http_status?: number | null
  verified?: boolean
  country?: string
  industry?: string
  sub_industry?: string
  employee?: string
  revenue?: string
  title?: string
}

type WebsiteAnalysis = {
  companyName?: string
  description?: string
  industry?: string
  products?: string[]
  targetMarkets?: string[]
  businessModel?: string
}

type SelectedTarget = { country: string; industry: string }

type StartMessage = {
  type: "start"
  payload: {
    baseUrl: string
    leads: LeadForScoring[]
    websiteAnalysis: WebsiteAnalysis
    selectedTarget: SelectedTarget
    userQuery?: string
    workspaceId?: string
    batchSize?: number
    concurrency?: number
  }
}

type AbortMessage = { type: "abort" }

type IncomingMessage = StartMessage | AbortMessage

type OutgoingMessage =
  | { type: "score"; leadId: string; score: number; reason?: string; progress: number }
  | { type: "complete"; totalProcessed: number }
  | { type: "error"; error: string }

function parseSSELine(line: string): { event?: string; data?: string } {
  const eventMatch = line.match(/^event:\s*(.+)$/)
  const dataMatch = line.match(/^data:\s*(.+)$/)
  return {
    event: eventMatch?.[1],
    data: dataMatch?.[1],
  }
}

function parseSSEChunk(chunk: string): Array<{ event: string; data: unknown }> {
  const results: Array<{ event: string; data: unknown }> = []
  const blocks = chunk.split("\n\n").filter((b) => b.trim())

  for (const block of blocks) {
    const lines = block.split("\n")
    let eventType = ""
    let eventData = ""

    for (const line of lines) {
      const { event, data } = parseSSELine(line.trim())
      if (event) {
        eventType = event
      }
      if (data) {
        eventData = data
      }
    }

    if (eventType && eventData) {
      try {
        results.push({ event: eventType, data: JSON.parse(eventData) })
      } catch {
        // ignore
      }
    }
  }

  return results
}

let aborted = false
let controllers: AbortController[] = []

function post(msg: OutgoingMessage) {
  self.postMessage(msg)
}

async function processBatch(params: {
  url: string
  body: unknown
  onScore: (leadId: string, score: number, reason?: string) => void
  signal: AbortSignal
}): Promise<void> {
  const { url, body, onScore, signal } = params

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
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
    if (aborted) {
      break
    }

    buffer += decoder.decode(value, { stream: true })

    const lastDoubleNewline = buffer.lastIndexOf("\n\n")
    if (lastDoubleNewline === -1) {
      continue
    }

    const completeChunks = buffer.substring(0, lastDoubleNewline + 2)
    buffer = buffer.substring(lastDoubleNewline + 2)

    const events = parseSSEChunk(completeChunks)
    for (const { event, data } of events) {
      if (event !== "score") {
        continue
      }
      const payload = data as Record<string, unknown>
      const leadId = payload.leadId as string | undefined
      const score = payload.score as number | undefined
      const reason = payload.reason as string | undefined
      if (!leadId || typeof score !== "number") {
        continue
      }
      onScore(leadId, score, reason)
    }
  }
}

async function runStart(msg: StartMessage) {
  aborted = false
  controllers = []

  const {
    baseUrl,
    leads,
    websiteAnalysis,
    selectedTarget,
    userQuery,
    workspaceId,
    batchSize,
    concurrency,
  } = msg.payload

  const url = `${baseUrl}/api/v1/lead-discovery/score`

  const size = Math.max(1, Math.min(batchSize ?? 100, 500))
  const batches: LeadForScoring[][] = []
  for (let i = 0; i < leads.length; i += size) {
    batches.push(leads.slice(i, i + size))
  }

  const desiredConcurrency = Math.max(1, Math.min(concurrency ?? (leads.length >= 200 ? 2 : 1), 4))
  const workerCount = Math.max(1, Math.min(desiredConcurrency, batches.length))

  const seen = new Set<string>()
  let processed = 0
  const total = leads.length

  const onScore = (leadId: string, score: number, reason?: string) => {
    if (!seen.has(leadId)) {
      seen.add(leadId)
      processed++
    }
    const progress = total > 0 ? Math.round((processed / total) * 100) : 0
    post({ type: "score", leadId, score, reason, progress })
  }

  let nextBatchIndex = 0

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const idx = nextBatchIndex
      nextBatchIndex++
      const batch = batches[idx]
      if (!batch) {
        break
      }
      if (aborted) {
        break
      }

      const controller = new AbortController()
      controllers.push(controller)

      await processBatch({
        url,
        body: {
          leads: batch,
          websiteAnalysis,
          selectedTarget,
          userQuery,
          workspaceId,
        },
        onScore,
        signal: controller.signal,
      })
    }
  })

  await Promise.all(workers)

  if (!aborted) {
    post({ type: "complete", totalProcessed: processed })
  }
}

self.onmessage = (e: MessageEvent<IncomingMessage>) => {
  const data = e.data
  if (data.type === "abort") {
    aborted = true
    for (const c of controllers) {
      c.abort()
    }
    controllers = []
    return
  }

  runStart(data).catch((error) => {
    const message = error instanceof Error ? error.message : "적합도 계산 실패"
    post({ type: "error", error: message })
  })
}
