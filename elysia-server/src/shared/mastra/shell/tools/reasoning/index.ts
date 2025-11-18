import { createTool } from "@mastra/core"
import { z } from "zod"

export const reasoningTool = createTool({
  id: "reasoning-tool",
  description: "Inner system 2 thinking log, use this as scratchpad",
  inputSchema: z.object({
    reasoning: z.string().describe("The reasoning to save"),
  }),
  outputSchema: z.string().describe("The reasoning result"),
  // biome-ignore lint/correctness/noUnusedFunctionParameters: ignored
  execute: async ({ context }) => {
    return "Reasoning saved"
  },
})
