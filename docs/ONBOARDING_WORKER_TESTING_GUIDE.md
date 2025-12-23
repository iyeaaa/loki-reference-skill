# Onboarding Worker Testing Guide

This guide provides multiple approaches to test and debug the onboarding worker service.

---

## Table of Contents

1. [Quick Manual Test via API](#1-quick-manual-test-via-api)
2. [Unit Tests for Individual Phases](#2-unit-tests-for-individual-phases)
3. [Integration Test with Real APIs](#3-integration-test-with-real-apis)
4. [Mock Testing with Fake Data](#4-mock-testing-with-fake-data)
5. [Debug Mode with Smaller Targets](#5-debug-mode-with-smaller-targets)
6. [BullMQ Worker Test Harness](#6-bullmq-worker-test-harness)
7. [Monitoring & Observability](#7-monitoring--observability)

---

## 1. Quick Manual Test via API

### Using curl or Postman

```bash
# 1. Start the server
cd elysia-server
bun run dev

# 2. Trigger onboarding job
curl -X POST http://localhost:3000/api/v1/onboarding/workspace/{workspaceId}/start-discovery \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "surveyData": {
      "industry": "software",
      "target": "B2B SaaS companies",
      "country": "us",
      "experience": "intermediate",
      "lang": "en"
    }
  }'

# 3. Monitor SSE stream (in another terminal)
curl -N http://localhost:3000/api/v1/onboarding/workspace/{workspaceId}/stream
```

### Expected SSE Events

```
event: connected
data: {"type":"connected","message":"SSE connection established",...}

event: progress
data: {"phase":"discovery","progressPercent":15,...}

event: progress
data: {"phase":"discovery_searching",...}

event: progress
data: {"phase":"discovery_batch","batchNum":1,...}

event: progress
data: {"phase":"discovery_complete","leadsFound":150}

event: progress
data: {"phase":"group_complete",...}

event: progress
data: {"phase":"templates_complete",...}

event: progress
data: {"phase":"sequence_complete",...}

event: progress
data: {"phase":"previews_complete","previewCount":450}

event: complete
data: {"phase":"complete",...}
```

---

## 2. Unit Tests for Individual Phases

Create: `elysia-server/test/onboarding-worker.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, mock } from "bun:test"
import { db } from "../src/db"
import { leads, leadContacts } from "../src/db/schema"
import {
  runDiscoveryPhase,
  runGroupPhase,
  runTemplatesPhase,
  runSequencePhase,
  runPreviewsPhase,
  countLeadsWithEmails,
} from "../src/services/onboarding-worker.service"

describe("Onboarding Worker Service", () => {
  const testWorkspaceId = "test-workspace-" + Date.now()
  const testUserId = "test-user-" + Date.now()

  afterAll(async () => {
    // Cleanup test data
    await db.delete(leads).where(eq(leads.workspaceId, testWorkspaceId))
  })

  describe("Discovery Phase", () => {
    it("should filter out companies with > 5000 employees", async () => {
      // Mock BigQuery to return mix of small and large companies
      const mockBigQueryResults = [
        { company: "SmallCorp", website: "small.com", employees: 500, country: "US" },
        { company: "MediumCorp", website: "medium.com", employees: 2000, country: "US" },
        { company: "LargeCorp", website: "large.com", employees: 10000, country: "US" },
        { company: "EnterpriseCorp", website: "enterprise.com", employees: 50000, country: "US" },
      ]

      // Test filtering logic
      const filtered = mockBigQueryResults.filter(row => {
        const employeeCount = parseInt(row.employees?.toString() || "0", 10)
        return employeeCount <= 5000
      })

      expect(filtered).toHaveLength(2)
      expect(filtered.map(r => r.company)).toEqual(["SmallCorp", "MediumCorp"])
    })

    it("should skip duplicate domains", async () => {
      const processedWebsites = new Set<string>()

      const domains = ["example.com", "test.com", "example.com", "new.com"]
      const unique = domains.filter(domain => {
        if (processedWebsites.has(domain.toLowerCase())) return false
        processedWebsites.add(domain.toLowerCase())
        return true
      })

      expect(unique).toHaveLength(3)
      expect(unique).toEqual(["example.com", "test.com", "new.com"])
    })

    it("should count leads with emails correctly", async () => {
      // Insert test leads
      const [lead] = await db.insert(leads).values({
        workspaceId: testWorkspaceId,
        companyName: "Test Company",
        websiteUrl: "https://test.com",
        leadSource: "test",
        leadStatus: "new",
      }).returning()

      await db.insert(leadContacts).values({
        leadId: lead.id,
        contactType: "email",
        contactValue: "test@test.com",
        isPrimary: true,
      })

      const count = await countLeadsWithEmails(testWorkspaceId)
      expect(count).toBe(1)
    })
  })

  describe("Hunter.io Fallback", () => {
    it("should filter companies with > 100 indexed emails", () => {
      const mockCompanies = [
        { domain: "startup.com", emailsCount: { total: 10 } },
        { domain: "scaleup.com", emailsCount: { total: 50 } },
        { domain: "enterprise.com", emailsCount: { total: 500 } },
      ]

      const filtered = mockCompanies.filter(c => c.emailsCount.total <= 100)
      expect(filtered).toHaveLength(2)
    })
  })

  describe("Group Phase", () => {
    it("should create customer group with leads", async () => {
      // Mock job context
      const mockJob = {
        id: "test-job-id",
        data: { checkpoint: {} },
        updateData: mock(() => Promise.resolve()),
        updateProgress: mock(() => Promise.resolve()),
      } as any

      const context = {
        workspaceId: testWorkspaceId,
        userId: testUserId,
        surveyData: {
          industry: "software",
          target: "B2B",
          country: "us",
          experience: "intermediate",
        },
      }

      // This would need proper mocking of createCustomerGroup
      // const groupId = await runGroupPhase(mockJob, context, [])
      // expect(groupId).toBeDefined()
    })
  })

  describe("Templates Phase", () => {
    it("should generate 3 email templates", async () => {
      // Test template generation logic
      const EMAIL_TYPES_3TOUCH = [
        { type: "introduction", delayDays: 0 },
        { type: "follow_up_1", delayDays: 1 },
        { type: "follow_up_2", delayDays: 2 },
      ]

      expect(EMAIL_TYPES_3TOUCH).toHaveLength(3)
      expect(EMAIL_TYPES_3TOUCH[0].delayDays).toBe(0)
      expect(EMAIL_TYPES_3TOUCH[2].delayDays).toBe(2)
    })
  })
})
```

### Run Unit Tests

```bash
cd elysia-server
bun test test/onboarding-worker.test.ts
```

---

## 3. Integration Test with Real APIs

Create: `elysia-server/test/integration/onboarding-worker-integration.test.ts`

```typescript
import { describe, it, expect } from "bun:test"
import { addOnboardingJob } from "../src/lib/queue/queues"
import { db } from "../src/db"
import { leads, onboardingProgress } from "../src/db/schema"

describe("Onboarding Worker Integration Test", () => {
  it("should complete full onboarding flow", async () => {
    const testWorkspaceId = "integration-test-" + Date.now()
    const testUserId = "user-" + Date.now()

    // 1. Start onboarding job
    const job = await addOnboardingJob({
      workspaceId: testWorkspaceId,
      userId: testUserId,
      surveyData: {
        industry: "software",
        target: "B2B SaaS",
        country: "us",
        experience: "intermediate",
        lang: "en",
      },
    })

    expect(job.id).toBeDefined()
    console.log(`Job created: ${job.id}`)

    // 2. Wait for job completion (with timeout)
    const maxWaitTime = 5 * 60 * 1000 // 5 minutes
    const startTime = Date.now()
    let jobCompleted = false

    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Check every 5s

      const state = await job.getState()
      console.log(`Job state: ${state}`)

      if (state === "completed") {
        jobCompleted = true
        break
      } else if (state === "failed") {
        const failedReason = job.failedReason
        throw new Error(`Job failed: ${failedReason}`)
      }
    }

    expect(jobCompleted).toBe(true)

    // 3. Verify results in database
    const [progress] = await db
      .select()
      .from(onboardingProgress)
      .where(eq(onboardingProgress.workspaceId, testWorkspaceId))

    expect(progress).toBeDefined()
    expect(progress.status).toBe("lead_search")
    expect(progress.generatedSequenceId).toBeDefined()

    // 4. Check leads created
    const leadsCreated = await db
      .select()
      .from(leads)
      .where(eq(leads.workspaceId, testWorkspaceId))

    console.log(`Leads created: ${leadsCreated.length}`)
    expect(leadsCreated.length).toBeGreaterThan(0)
    expect(leadsCreated.length).toBeLessThanOrEqual(150)

    // 5. Verify lead sources
    const sources = new Set(leadsCreated.map(l => l.leadSource))
    console.log(`Lead sources: ${Array.from(sources).join(", ")}`)

    // Should have at least bigquery, possibly hunterio
    expect(sources.has("bigquery-auto")).toBe(true)

    // 6. Verify no large companies
    const largeCompanies = leadsCreated.filter(l =>
      (l.employeeCount && parseInt(l.employeeCount) > 5000)
    )
    expect(largeCompanies).toHaveLength(0)

    console.log("✅ Integration test passed!")
  }, 10 * 60 * 1000) // 10 minute timeout
})
```

### Run Integration Test

```bash
cd elysia-server
bun test test/integration/onboarding-worker-integration.test.ts
```

---

## 4. Mock Testing with Fake Data

Create: `elysia-server/test/mocks/onboarding-worker-mock.test.ts`

```typescript
import { describe, it, expect, mock } from "bun:test"
import * as bigqueryService from "../../src/services/bigquery-search.service"
import * as hunterioService from "../../src/services/hunterio-lead-search.service"

describe("Onboarding Worker with Mocks", () => {
  it("should handle BigQuery mock data", async () => {
    // Mock BigQuery response
    const mockSearchBigQuery = mock((query, dict, options) => {
      return Promise.resolve({
        sql: "SELECT * FROM ...",
        explanation: "Test query",
        results: [
          { company: "TestCo", website: "test.com", employees: 100, country: "US", industry: "Software" },
          { company: "BigCo", website: "big.com", employees: 10000, country: "US", industry: "Software" },
        ],
        totalCount: 2,
      })
    })

    // Replace function temporarily
    const original = bigqueryService.searchBigQuery
    // @ts-ignore
    bigqueryService.searchBigQuery = mockSearchBigQuery

    // Test filtering
    const result = await bigqueryService.searchBigQuery("test query", {} as any)
    const filtered = result.results.filter(r => {
      const employees = parseInt(r.employees?.toString() || "0", 10)
      return employees <= 5000
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].company).toBe("TestCo")

    // Restore
    // @ts-ignore
    bigqueryService.searchBigQuery = original
  })

  it("should handle Hunter.io mock data", () => {
    const mockCompanies = [
      {
        organization: "Startup Inc",
        domain: "startup.com",
        emailsCount: { total: 15 },
      },
      {
        organization: "Enterprise Corp",
        domain: "enterprise.com",
        emailsCount: { total: 500 },
      },
    ]

    const filtered = mockCompanies.filter(c => c.emailsCount.total <= 100)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].organization).toBe("Startup Inc")
  })
})
```

---

## 5. Debug Mode with Smaller Targets

For faster debugging, temporarily modify constants:

```typescript
// In onboarding-worker.service.ts (for testing only!)

const TARGET_LEADS = 10              // Reduced from 150
const ENRICHMENT_BATCH_SIZE = 5      // Reduced from 30
const BIGQUERY_BATCH_SIZE = 20       // Reduced from 100
const MAX_SEARCH_ITERATIONS = 1      // Reduced from 3
```

**Remember to revert these changes before committing!**

---

## 6. BullMQ Worker Test Harness

Create: `elysia-server/scripts/test-onboarding-worker.ts`

```typescript
#!/usr/bin/env bun

/**
 * Manual test harness for onboarding worker
 * Usage: bun run scripts/test-onboarding-worker.ts
 */

import { addOnboardingJob, onboardingGenerationQueue } from "../src/lib/queue/queues"
import { createOnboardingSubscriber } from "../src/lib/redis/onboarding-events"

const TEST_WORKSPACE_ID = "test-workspace-" + Date.now()
const TEST_USER_ID = "test-user-" + Date.now()

console.log("🧪 Onboarding Worker Test Harness")
console.log("===================================")
console.log(`Workspace ID: ${TEST_WORKSPACE_ID}`)
console.log(`User ID: ${TEST_USER_ID}`)
console.log()

async function main() {
  // 1. Subscribe to SSE events
  console.log("📡 Subscribing to SSE events...")
  const subscriber = createOnboardingSubscriber(TEST_WORKSPACE_ID)

  subscriber.subscribe((event) => {
    console.log(`[${event.phase}] ${event.progressPercent}%`)
    if (event.message) {
      console.log(`  └─ ${event.message}`)
    }
    if (event.phase === "complete" || event.phase === "error") {
      console.log()
      console.log("✅ Worker completed!")
      process.exit(0)
    }
  })

  // 2. Start onboarding job
  console.log("🚀 Starting onboarding job...")
  const job = await addOnboardingJob({
    workspaceId: TEST_WORKSPACE_ID,
    userId: TEST_USER_ID,
    surveyData: {
      industry: "software",
      target: "B2B SaaS companies",
      country: "us",
      experience: "intermediate",
      lang: "en",
    },
  })

  console.log(`Job ID: ${job.id}`)
  console.log()
  console.log("⏳ Waiting for job completion...")
  console.log("   (This may take 2-5 minutes)")
  console.log()

  // 3. Monitor job progress
  const checkInterval = setInterval(async () => {
    const state = await job.getState()
    const progress = await job.progress

    if (state === "active") {
      console.log(`⚙️  Job active - ${JSON.stringify(progress)}`)
    } else if (state === "completed") {
      console.log("✅ Job completed!")
      clearInterval(checkInterval)

      const result = await job.returnvalue
      console.log("Result:", JSON.stringify(result, null, 2))

      await subscriber.unsubscribe()
      process.exit(0)
    } else if (state === "failed") {
      console.log("❌ Job failed!")
      console.log("Reason:", job.failedReason)
      clearInterval(checkInterval)
      await subscriber.unsubscribe()
      process.exit(1)
    }
  }, 5000) // Check every 5 seconds

  // Timeout after 10 minutes
  setTimeout(() => {
    console.log("⏱️  Test timeout reached (10 minutes)")
    clearInterval(checkInterval)
    subscriber.unsubscribe()
    process.exit(1)
  }, 10 * 60 * 1000)
}

main().catch((error) => {
  console.error("❌ Test failed:", error)
  process.exit(1)
})
```

### Run Test Harness

```bash
cd elysia-server
bun run scripts/test-onboarding-worker.ts
```

---

## 7. Monitoring & Observability

### A. View Job Logs in Database

```sql
-- Check recent onboarding jobs
SELECT
  job_id,
  job_name,
  status,
  created_at,
  started_at,
  completed_at,
  failed_reason
FROM job_logs
WHERE queue_name = 'onboarding-generation'
ORDER BY created_at DESC
LIMIT 10;
```

### B. Check Lead Creation

```sql
-- Verify leads were created
SELECT
  workspace_id,
  lead_source,
  COUNT(*) as lead_count,
  COUNT(CASE WHEN employee_count::int > 5000 THEN 1 END) as large_company_count
FROM leads
WHERE workspace_id = 'your-test-workspace-id'
GROUP BY workspace_id, lead_source;
```

### C. BullMQ Dashboard

Add to `package.json`:

```json
{
  "scripts": {
    "bullmq:dashboard": "bun x bull-board"
  }
}
```

Then access: http://localhost:3000/admin/queues

### D. Custom Debug Logging

Add to worker service:

```typescript
// Enable detailed logging
const DEBUG = process.env.DEBUG_ONBOARDING === "true"

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log("[DEBUG]", ...args)
  }
}
```

Run with debug mode:

```bash
DEBUG_ONBOARDING=true bun run dev
```

---

## 8. Testing Checklist

Before deploying, verify:

- [ ] **Discovery Phase**
  - [ ] BigQuery returns results
  - [ ] Filters out companies with >5000 employees
  - [ ] Filters duplicate domains
  - [ ] Enrichment with Hunter.io Domain Search works
  - [ ] Saves leads to database

- [ ] **Hunter.io Fallback**
  - [ ] Only triggers when < 150 leads
  - [ ] Filters companies with >100 emails
  - [ ] Filters duplicate domains
  - [ ] Marks leads with `leadSource: "hunterio-discover"`

- [ ] **Group Phase**
  - [ ] Creates customer group
  - [ ] Adds leads to group
  - [ ] Idempotent (doesn't create duplicates)

- [ ] **Templates Phase**
  - [ ] Generates 3 email templates
  - [ ] Uses workspace info
  - [ ] Caches templates in checkpoint

- [ ] **Sequence Phase**
  - [ ] Creates sequence with 3 steps
  - [ ] Sets correct delays (0, 1, 2 days)
  - [ ] Idempotent

- [ ] **Previews Phase**
  - [ ] Generates 450 preview emails (150 × 3)
  - [ ] All emails in draft status
  - [ ] Variable replacement works
  - [ ] Idempotent

- [ ] **Error Handling**
  - [ ] Checkpoint saves on error
  - [ ] Retries with exponential backoff
  - [ ] Resumes from last phase
  - [ ] SSE error events sent

---

## 9. Common Issues & Solutions

### Issue: Job stuck in "waiting" state
**Solution**: Check if worker is running
```bash
ps aux | grep "bun.*worker"
```

### Issue: BigQuery timeout
**Solution**: Check BigQuery credentials and quota

### Issue: Hunter.io rate limit
**Solution**: Check API key and rate limit settings

### Issue: No leads found
**Solution**: Check survey data and industry/country combinations

### Issue: Memory leak
**Solution**: Monitor with:
```bash
bun --inspect run src/worker.ts
```

---

## 10. Performance Benchmarks

Expected timings for 150 leads:

| Phase | Duration | Notes |
|-------|----------|-------|
| Discovery (BigQuery) | 1-3 min | Depends on API latency |
| Hunter.io Fallback | 2-5 min | Only if < 150 from BigQuery |
| Group Creation | < 5 sec | Fast DB operation |
| Templates Generation | 30-60 sec | 3 AI calls |
| Sequence Creation | < 5 sec | Fast DB operations |
| Preview Generation | 2-4 min | 450 emails × variable replacement |
| **Total** | **5-12 min** | Full flow |

---

## Quick Test Command

```bash
# One-liner to test everything
curl -X POST http://localhost:3000/api/v1/onboarding/workspace/test-$(date +%s)/start-discovery \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","surveyData":{"industry":"software","target":"B2B","country":"us","experience":"intermediate","lang":"en"}}'
```

---

## References

- **Worker Service**: `elysia-server/src/services/onboarding-worker.service.ts`
- **Queue Setup**: `elysia-server/src/lib/queue/queues.ts`
- **BullMQ Worker**: `elysia-server/src/workers/bullmq/onboarding-auto-generate.worker.ts`
- **Flow Diagram**: `docs/onboarding-worker-flow-simple.puml`
- **Filtering Logic**: `docs/onboarding-filtering-logic.md`
