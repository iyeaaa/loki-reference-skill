# Web Reader Summary - Shared Slice

A shared infrastructure slice that fetches web content and uses an LLM to answer queries about it.

## Architecture

This slice follows the **FCIS (Functional Core, Imperative Shell)** pattern:

```
web-reader-summary/
├── core/                    # Pure logic (100% testable)
│   ├── types.ts            # Type definitions and schemas
│   ├── validate.ts         # Input validation
│   └── prepare.ts          # LLM prompt preparation
├── shell/                   # I/O orchestration (thin)
│   └── execute.ts          # Main execution logic
├── index.ts                 # Public exports
└── README.md               # Documentation
```

## Usage

### Basic Usage

```typescript
import { executeWebReaderSummary } from "@/shared/web-reader-summary"

const result = await executeWebReaderSummary({
  url: "https://example.com/article",
  query: "What is the main topic of this article?"
})

if (result.isOk()) {
  console.log("Answer:", result.value)
} else {
  console.error("Error:", result.error)
}
```

### With Configuration

```typescript
import { executeWebReaderSummary } from "@/shared/web-reader-summary"

const result = await executeWebReaderSummary(
  {
    url: "https://example.com/article",
    query: "What is the main topic of this article?"
  },
  {
    model: "gpt-4o",              // Default: "gpt-4o-mini"
    temperature: 0.5,             // Default: 0.3
    maxContentLength: 100000      // Default: 50000
  }
)
```

### With Logging Context

```typescript
import { executeWebReaderSummary } from "@/shared/web-reader-summary"

const logger = {
  info: (msg: string, meta?: unknown) => console.log(msg, meta),
  error: (msg: string, meta?: unknown) => console.error(msg, meta)
}

const result = await executeWebReaderSummary(
  {
    url: "https://example.com/article",
    query: "Summarize the key points"
  },
  undefined,  // use default config
  { logger }  // pass logging context
)
```

## Core Functions (Pure Logic)

These functions are pure and can be tested independently:

### `validateWebReaderSummaryParams(params: unknown)`

Validates input parameters using Zod schema.

```typescript
import { validateWebReaderSummaryParams } from "@/shared/web-reader-summary"

const result = validateWebReaderSummaryParams({
  url: "https://example.com",
  query: "What is this about?"
})

if (result.success) {
  console.log("Valid params:", result.data)
} else {
  console.error("Validation error:", result.error)
}
```

### `prepareLLMPrompt(content: string, query: string, url: string)`

Prepares a formatted prompt for the LLM.

```typescript
import { prepareLLMPrompt } from "@/shared/web-reader-summary"

const prompt = prepareLLMPrompt(
  "Article content here...",
  "What is the main topic?",
  "https://example.com"
)
```

### `truncateContent(content: string, maxLength?: number)`

Truncates content to maximum length (default: 50000 characters).

```typescript
import { truncateContent } from "@/shared/web-reader-summary"

const truncated = truncateContent(longContent, 10000)
```

## Flow

1. **Validate** input parameters (core)
2. **Fetch** web content using `web-reader` shared slice (shell)
3. **Prepare** LLM prompt with content and query (core)
4. **Call** LLM to generate answer (shell)
5. **Return** Result with answer or error

## Error Handling

Returns `Result<string, WebReaderSummaryError>` using neverthrow:

```typescript
type WebReaderSummaryError =
  | { type: "VALIDATION_ERROR"; message: string; details: unknown }
  | { type: "WEB_READER_ERROR"; message: string; cause?: unknown }
  | { type: "LLM_ERROR"; message: string; cause?: unknown }
  | { type: "UNKNOWN_ERROR"; message: string; cause?: unknown }
```

## Dependencies

- **Shared Slices**: `web-reader` (for fetching web content)
- **External**: OpenAI (via AI SDK), neverthrow (for Result type)
- **Config**: Uses centralized config for API keys

## Testing Strategy

Following FCIS pattern:

- ✅ **Core functions**: Unit test all pure logic (validate, prepare, truncate)
- ❌ **Shell function**: Skip testing (thin orchestration only)

Test the core functions in isolation:

```typescript
import { prepareLLMPrompt, truncateContent } from "@/shared/web-reader-summary"

describe("prepareLLMPrompt", () => {
  it("formats prompt correctly", () => {
    const prompt = prepareLLMPrompt("content", "query", "url")
    expect(prompt).toContain("content")
    expect(prompt).toContain("query")
  })
})
```
