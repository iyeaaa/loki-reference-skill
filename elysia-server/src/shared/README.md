# Shared Slices

Infrastructure slices for cross-cutting concerns following the FCIS (Functional Core, Imperative Shell) pattern.

## Available Slices

### google-search

Resilient Google Search with global rate limiting using p-queue.

**Features:**
- ✅ Global rate limiting (1 concurrent request, max 10/second)
- ✅ Automatic retries with exponential backoff
- ✅ Comprehensive error handling
- ✅ Zod validation
- ✅ Type-safe Result pattern (neverthrow)

**Usage:**

```typescript
import { executeGoogleSearch } from "@/shared/google-search"

// Simple usage - uses centralized config
const result = await executeGoogleSearch({
  query: "AI companies in Austin",
  location: "Austin,Texas,United States",
  language: "en",
  page: 1,
})

// With optional overrides and logging
const resultWithOptions = await executeGoogleSearch(
  {
    query: "AI companies in Austin",
  },
  {
    // Optional: override retry/timeout behavior
    retries: 5,
    timeout: 30000,
  },
  {
    // Optional: logging context
    logger: console,
  }
)

if (result.isOk()) {
  const data = result.value
  console.log(`Found ${data.organicResults.length} results`)
} else {
  const error = result.error
  console.error(`Search failed: ${error.type} - ${error.message}`)
}
```

**Architecture:**

```
google-search/
├── core/                   # Pure logic (testable)
│   ├── types.ts           # Zod schemas, types, error types
│   ├── validate.ts        # Zod validation
│   └── prepare.ts         # URL/header preparation
├── shell/                 # I/O operations
│   ├── rate-limit.ts      # p-queue configuration
│   └── execute.ts         # Main execution with retries
└── index.ts              # Public API
```

---

### web-reader

Resilient web content reader using Jina Reader API with global rate limiting.

**Features:**
- ✅ Global rate limiting (2 concurrent requests, max 20/second)
- ✅ Automatic retries with exponential backoff
- ✅ Comprehensive error handling
- ✅ Zod validation with URL protocol checks
- ✅ Type-safe Result pattern (neverthrow)
- ✅ Configurable viewport for rendering

**Usage:**

```typescript
import { executeWebReader } from "@/shared/web-reader"

// Simple usage - uses centralized config
const result = await executeWebReader({
  url: "https://example.com",
  viewport: {
    width: 1920,
    height: 1080,
  },
})

// With optional overrides and logging
const resultWithOptions = await executeWebReader(
  {
    url: "https://example.com",
  },
  {
    // Optional: override retry/timeout behavior
    retries: 5,
    timeout: 60000,
  },
  {
    // Optional: logging context
    logger: console,
  }
)

if (result.isOk()) {
  const content = result.value
  console.log(`Extracted ${content.length} characters`)
} else {
  const error = result.error
  console.error(`Read failed: ${error.type} - ${error.message}`)
}
```

**Architecture:**

```
web-reader/
├── core/                   # Pure logic (testable)
│   ├── types.ts           # Zod schemas, types, error types
│   ├── validate.ts        # Zod validation
│   └── prepare.ts         # Request body/header preparation
├── shell/                 # I/O operations
│   ├── rate-limit.ts      # p-queue configuration
│   └── execute.ts         # Main execution with retries
└── index.ts              # Public API
```

---

## Error Handling

Both slices use the Result pattern from `neverthrow` for type-safe error handling:

```typescript
type Result<T, E> = Ok<T> | Err<E>

if (result.isOk()) {
  // result.value is the success value
} else {
  // result.error is the typed error
  switch (result.error.type) {
    case "VALIDATION_ERROR":
      // Handle validation errors
      break
    case "RATE_LIMIT_ERROR":
      // Handle rate limit (429) errors
      break
    case "HTTP_ERROR":
      // Handle other HTTP errors
      break
    case "NETWORK_ERROR":
      // Handle network failures
      break
    case "TIMEOUT_ERROR":
      // Handle timeouts
      break
    case "UNKNOWN_ERROR":
      // Handle unexpected errors
      break
  }
}
```

## Rate Limiting

Both slices use `p-queue` for global rate limiting:

**Google Search:**
- Concurrency: 1 (serial execution)
- Interval cap: 10 requests per second
- Prevents 429 errors from HasData API

**Web Reader:**
- Concurrency: 2 (parallel execution)
- Interval cap: 20 requests per second
- Prevents 429 errors from Jina Reader API

**Queue Statistics:**

```typescript
import { getQueueStats } from "@/shared/google-search"

const stats = getQueueStats()
console.log({
  size: stats.size,         // Pending tasks
  pending: stats.pending,   // Currently running
  isPaused: stats.isPaused, // Queue status
})
```

## Testing

Core functions are pure and 100% testable:

```typescript
import { validateSearchParams } from "@/shared/google-search"

describe("validateSearchParams", () => {
  it("should validate valid params", () => {
    const result = validateSearchParams({
      query: "test",
      page: 1,
    })
    expect(result.success).toBe(true)
  })

  it("should reject empty query", () => {
    const result = validateSearchParams({
      query: "",
    })
    expect(result.success).toBe(false)
  })
})
```

## FCIS Pattern

Both slices follow the Functional Core, Imperative Shell pattern:

**Core (Pure Logic):**
- All business rules and validations
- Pure functions: `f(x) = y`
- No side effects, I/O, or state
- 100% unit testable

**Shell (Orchestration):**
- Thin handlers that orchestrate I/O
- Call core functions for logic
- Wrap outcomes in Result type
- Handle retries and rate limiting

This separation ensures:
- ✅ Business logic is isolated and testable
- ✅ Side effects are contained at boundaries
- ✅ Type safety throughout
- ✅ Easy to understand and maintain
