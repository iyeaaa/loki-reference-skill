# Type-Safe API Tests with Eden Treaty

This directory contains type-safe API tests using [Eden Treaty](https://elysiajs.com/eden/treaty/overview.html) for the Elysia backend.

## Why Eden Treaty?

- ✅ **Full Type Safety** - Get TypeScript autocomplete and type checking for all API calls
- ✅ **No HTTP Overhead** - Tests run in-process without network calls
- ✅ **Fast Execution** - Runs with Bun's native test runner
- ✅ **Real API Testing** - Tests actual route handlers, not mocked implementations

## Test Structure

```
test/
├── helpers/                    # Reusable test helper functions
│   ├── auth.helper.ts         # Authentication (signup, signin, token generation)
│   ├── sse.helper.ts          # SSE response parsing utilities
│   └── lead-upload.helper.ts  # Lead file upload utilities
├── fixtures/                   # Test data generators
│   └── excel.fixture.ts       # Excel file generation for testing
├── setup.ts                   # Test app setup for Eden Treaty
├── lead-import.test.ts        # Type-safety tests for lead import API
├── lead-import-requirements.test.ts  # Integration tests for requirements
└── README.md                  # This file
```

## Setup

### For In-Process Tests (Eden Treaty)
No additional setup required! Just ensure:

1. Environment variables are configured in `.env` or `.env.local`

### For Integration Tests (Against Running Server)
1. Start the server:
   ```bash
   bun run dev
   ```
2. Environment variables are configured in `.env` or `.env.local`

## Running Tests

### Run all tests
```bash
bun test
```

### Run specific test file
```bash
bun test test/lead-import.test.ts
```

### Watch mode (auto-rerun on changes)
```bash
bun test --watch
```

### Run with coverage
```bash
bun test --coverage
```

## Test Structure

### `test/setup.ts`
Creates a test app instance with routes mounted:
```typescript
export const createTestApp = () => {
  return new Elysia()
    .use(leadImportRoutes)
}
```

### `test/lead-import.test.ts`
Tests for lead import API with:
- ✅ Duplicate email detection
- ✅ Group tag assignment
- ✅ File validation
- ✅ Sheet name extraction

## Writing Tests

### Basic Example
```typescript
import { describe, expect, it } from "bun:test"
import { treaty } from "@elysiajs/eden"
import { createTestApp } from "./setup"

describe("My API", () => {
  const app = createTestApp()
  const api = treaty(app)

  it("should upload leads", async () => {
    const { data, error } = await api.api.v1.admin["lead-import"].upload.post({
      file: myFile,
      workspaceId: "test-id",
    })

    expect(error).toBeUndefined()
    expect(data).toBeDefined()
  })
})
```

### Type Safety Benefits
```typescript
// ✅ TypeScript knows the exact endpoint structure
await api.api.v1.admin["lead-import"].upload.post({
  file: myFile,           // ✅ Type checked
  workspaceId: "id",      // ✅ Type checked
  customerGroupId: "id",  // ✅ Optional, type checked
})

// ❌ TypeScript error - invalid parameter
await api.api.v1.admin["lead-import"].upload.post({
  invalidParam: "value"  // ❌ Error: Object literal may only specify known properties
})

// ✅ Response is also type-safe
const { data, error } = await api.endpoint.get()
if (data) {
  data.success      // ✅ Autocomplete available
  data.sheetNames   // ✅ Type checked
}
```

## Test Coverage

### Lead Import (`test/lead-import.test.ts`)

1. **Duplicate Email Detection**
   - Uploads file with duplicate email
   - Verifies API accepts request
   - Tests SSE response handling

2. **Group Tag Assignment**
   - Uploads with `customerGroupId`
   - Verifies group assignment in response

3. **Sheet Names Extraction**
   - Uploads Excel file
   - Gets list of available sheets
   - Verifies type-safe response

4. **File Validation**
   - Tests invalid file type rejection
   - Verifies error response format

## Advantages Over Other Testing Approaches

### vs Unit Tests
- ✅ Tests real API behavior
- ✅ Catches integration issues
- ✅ No mocking required

### vs Playwright E2E
- ✅ No browser/HTTP overhead
- ✅ Much faster execution
- ✅ Full TypeScript support
- ✅ Easier to debug

### vs Manual cURL Testing
- ✅ Automated and repeatable
- ✅ Type-safe API calls
- ✅ CI/CD integration ready

## Handling Special Cases

### SSE Responses
For Server-Sent Events endpoints, the response is a stream:
```typescript
const response = await api.endpoint.post({ ... })

// Parse SSE events from response body
const body = await response.text()
const events = body
  .split("\n\n")
  .filter(line => line.startsWith("data: "))
  .map(line => JSON.parse(line.replace("data: ", "")))
```

### File Uploads
```typescript
const buffer = generateExcelFile(...)
const file = new File([buffer], "test.xlsx", {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
})

await api.endpoint.post({ file })
```

## CI/CD Integration

Add to your CI pipeline:
```yaml
- name: Run Tests
  run: bun test

- name: Check Coverage
  run: bun test --coverage
```

## Troubleshooting

### "Cannot find module" errors
```bash
bun install
```

### Environment variables not loaded
- Ensure `.env` or `.env.local` exists
- Check `dotenv/config` is imported at top of test file

### Type errors in test
- Verify `@elysiajs/eden` is installed
- Check route structure matches API

## Best Practices

1. **Use descriptive test names**
   ```typescript
   it("should detect duplicate emails and return them in response")
   ```

2. **Test one thing at a time**
   ```typescript
   it("should reject invalid file types")
   it("should accept valid Excel files")
   ```

3. **Use beforeAll/afterAll for setup/cleanup**
   ```typescript
   beforeAll(async () => {
     // Create test data
   })

   afterAll(async () => {
     // Cleanup
   })
   ```

4. **Leverage type safety**
   ```typescript
   // Let TypeScript guide you
   const { data, error } = await api. // Autocomplete shows available routes
   ```
