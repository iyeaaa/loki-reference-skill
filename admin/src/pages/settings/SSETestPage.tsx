import { Activity, CheckCircle2, Loader2, Play, XCircle } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type SSETestEvent, sseTestApi } from "@/lib/api/services/sse-test"

type EventLogItem = SSETestEvent & {
  id: string
}

export function SSETestPage() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [events, setEvents] = useState<EventLogItem[]>([])
  const [currentProgress, setCurrentProgress] = useState(0)
  const [streamedText, setStreamedText] = useState("")
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connected" | "completed" | "error"
  >("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleStartStream = async () => {
    // Reset state
    setEvents([])
    setCurrentProgress(0)
    setStreamedText("")
    setErrorMessage(null)
    setConnectionStatus("idle")
    setIsStreaming(true)

    try {
      await sseTestApi.streamTest({
        onEvent: (event) => {
          // Add event to log
          const logItem: EventLogItem = {
            ...event,
            id: `${event.type}-${Date.now()}-${Math.random()}`,
          }
          setEvents((prev) => [...prev, logItem])

          // Handle different event types
          switch (event.type) {
            case "connected":
              setConnectionStatus("connected")
              break

            case "progress":
              if (event.progress !== undefined) {
                setCurrentProgress(event.progress)
              }
              break

            case "text_chunk":
              if (event.accumulatedText) {
                setStreamedText(event.accumulatedText)
              }
              break

            case "done":
              setConnectionStatus("completed")
              setIsStreaming(false)
              break

            case "error":
              setConnectionStatus("error")
              setErrorMessage(event.message || "Unknown error")
              setIsStreaming(false)
              break
          }
        },
        onComplete: () => {
          console.log("[SSE Test Page] Stream completed")
          setIsStreaming(false)
          setConnectionStatus("completed")
        },
        onError: (error) => {
          console.error("[SSE Test Page] Stream error:", error)
          setErrorMessage(error)
          setConnectionStatus("error")
          setIsStreaming(false)
        },
      })
    } catch (error) {
      console.error("[SSE Test Page] Failed to start stream:", error)
      setErrorMessage(error instanceof Error ? error.message : "Failed to start stream")
      setConnectionStatus("error")
      setIsStreaming(false)
    }
  }

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <Activity className="h-5 w-5 animate-pulse text-blue-500" />
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Connected - Streaming data..."
      case "completed":
        return "Stream completed successfully"
      case "error":
        return "Stream error"
      case "idle":
        return "Ready to start"
      default:
        return "Unknown status"
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case "connected":
        return "🔗"
      case "progress":
        return "⚡"
      case "data":
        return "📦"
      case "text_chunk":
        return "✍️"
      case "ping":
        return "💓"
      case "done":
        return "✅"
      case "error":
        return "❌"
      default:
        return "📌"
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case "connected":
        return "text-blue-600"
      case "progress":
        return "text-purple-600"
      case "data":
        return "text-green-600"
      case "text_chunk":
        return "text-orange-600"
      case "ping":
        return "text-pink-600"
      case "done":
        return "text-green-700"
      case "error":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="mb-2 font-bold text-3xl">SSE Test Page</h1>
        <p className="text-muted-foreground">
          Test Server-Sent Events (SSE) functionality with real-time data streaming
        </p>
      </div>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Stream Control
          </CardTitle>
          <CardDescription>{getStatusText()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              className="w-full sm:w-auto"
              disabled={isStreaming}
              onClick={handleStartStream}
              size="lg"
            >
              {isStreaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Streaming...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start SSE Stream Test
                </>
              )}
            </Button>
          </div>

          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="font-medium text-red-800 text-sm">Error: {errorMessage}</p>
            </div>
          )}

          {/* Progress Display */}
          {currentProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Progress</span>
                <span className="text-muted-foreground">{currentProgress}%</span>
              </div>
              <Progress className="h-2" value={currentProgress} />
            </div>
          )}

          {/* Text Streaming Display */}
          {streamedText && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Streamed Text:</h4>
              <div className="rounded-md border bg-gray-50 p-4">
                <p className="whitespace-pre-wrap text-gray-700 text-sm">{streamedText}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Log */}
      <Card>
        <CardHeader>
          <CardTitle>Event Log</CardTitle>
          <CardDescription>
            Real-time log of all received SSE events ({events.length} events)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] w-full rounded-md border p-4">
            {events.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <p>No events yet. Click "Start SSE Stream Test" to begin.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    className="rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                    key={event.id}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getEventIcon(event.type)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`font-semibold text-sm uppercase ${getEventColor(event.type)}`}
                          >
                            {event.type}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {event.message && (
                          <p className="mb-2 text-gray-700 text-sm">{event.message}</p>
                        )}
                        {event.progress !== undefined && (
                          <div className="flex items-center gap-2">
                            <Progress className="h-1.5 flex-1" value={event.progress} />
                            <span className="text-muted-foreground text-xs">{event.progress}%</span>
                          </div>
                        )}
                        {event.chunk && (
                          <div className="mt-2 rounded border border-orange-200 bg-orange-50 p-2">
                            <p className="font-mono text-orange-800 text-xs">
                              Chunk: "{event.chunk}"
                            </p>
                          </div>
                        )}
                        {event.data !== undefined && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-blue-600 text-xs hover:text-blue-800">
                              View data payload
                            </summary>
                            <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs">
                              {typeof event.data === "string"
                                ? event.data
                                : JSON.stringify(event.data, null, 2)}
                            </pre>
                          </details>
                        )}
                        {event.totalDuration && (
                          <p className="mt-1 text-muted-foreground text-xs">
                            Duration: {event.totalDuration}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>About this test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground text-sm">
          <p>
            This page tests Server-Sent Events (SSE) functionality, which is used for real-time data
            streaming from the server to the client.
          </p>
          <p>The test stream includes:</p>
          <ul className="ml-4 list-inside list-disc space-y-1">
            <li>Connection establishment event</li>
            <li>Progress updates (10 steps)</li>
            <li>Data streaming (sample user data)</li>
            <li>Text chunk streaming (simulating AI responses)</li>
            <li>Heartbeat/ping events (connection keep-alive)</li>
            <li>Completion event</li>
          </ul>
          <p className="pt-2">Total expected duration: ~20 seconds</p>
        </CardContent>
      </Card>
    </div>
  )
}
