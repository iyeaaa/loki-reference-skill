// Node.js 18+ has fetch as global
import pRetry from "p-retry"
import { mastraConfig } from "../../config"

export const jinaReader = async (params: { url: string }) => {
  const url = "https://r.jina.ai/"
  const token = mastraConfig.jinaApiKey

  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Engine": "browser",
    },
    body: JSON.stringify({
      url: params.url,
      viewport: {
        width: 390,
        height: 844,
      },
    }),
  }

  const response = await pRetry(
    async () => {
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(
          `Jina Reader failed with status ${response.status}.Error: ${response.statusText}`,
        )
      }
      return await response.text()
    },
    {
      onFailedAttempt: (error) => {
        console.error(
          `Jina Reader Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`,
        )
      },
    },
  )

  return response
}
