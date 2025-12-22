# Lead Search Integration: Hunter.io Discovery

## Overview

This document describes the integration of Hunter.io Discover API as a fallback lead discovery source during onboarding, complementing the existing BigQuery (Apollo dataset) search.

## Architecture

```
runDiscoveryPhase():

STEP 1: BigQuery Discovery
   a. Run existing BigQuery search
   b. Enrich leads (email enrichment)
   c. Save to DB

STEP 2: Hunter.io Fallback (IF lead count < 250)
   a. Call LLM to generate Hunter.io Discover params from surveyData
   b. Loop (paginate) until 250 total leads OR no more results:
      - Call Hunter.io Discover API (offset pagination)
      - Skip big companies (>1000 employees)
      - For each company: call Hunter.io Domain Search for emails
      - Filter to leads with emails
      - Deduplicate against existing leads
   c. Save to DB

Return all lead IDs
```

## Implementation

### 1. LLM Query Generator (Two-Step Approach)

**File:** `elysia-server/src/services/hunterio-query-generator.service.ts`

Uses a two-step LLM approach:
1. **GPT-5.1**: Generate search strategy from survey data
2. **GPT-4o-mini**: Structured extraction with Zod schema

```typescript
import { ChatOpenAI } from "@langchain/openai"
import { z } from "zod"

// Step 1: GPT-5.1 for strategy generation
const generatorLLM = new ChatOpenAI({
  model: "gpt-5.1",
  temperature: 0.3,
})

// Step 2: GPT-4o-mini for structured extraction
const extractorLLM = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
})

// Simplified schema for structured output
const HunterQueryOutputSchema = z.object({
  query: z.string(),
  country_code: z.string(),
  industries: z.array(z.string()),
  headcount: z.array(z.enum(["1-10", "11-50", "51-200", "201-500", "501-1000"])),
  keywords: z.array(z.string()),
})

export async function generateHunterioQuery(surveyData: SurveyData) {
  // Step 1: Generate strategy with GPT-4o
  const strategy = await generatorLLM.invoke(strategyPrompt)

  // Step 2: Extract structured params with GPT-4o-mini
  const structuredLLM = extractorLLM.withStructuredOutput(HunterQueryOutputSchema)
  const extracted = await structuredLLM.invoke(extractionPrompt)

  // Transform to Hunter.io API format
  return {
    query: extracted.query,
    headquarters_location: { include: [{ country: extracted.country_code }] },
    industry: { include: extracted.industries },
    headcount: extracted.headcount,
    keywords: { include: extracted.keywords, match: "all" },
    limit: 100,
    offset: 0,
  }
}
```

### 2. Hunter.io Discovery + Enrichment Function

**File:** `elysia-server/src/services/onboarding-worker.service.ts`

```typescript
import { searchLeadsWithHunter } from "./hunterio-lead-search.service"
import { generateHunterioQuery } from "./hunterio-query-generator.service"
import { searchDomainWithHunter } from "./hunterio-domain-search.service"

const TARGET_LEADS = 250
const HUNTERIO_MAX_PER_PAGE = 100
const HUNTERIO_MAX_EMAIL_COUNT = 100 // Skip companies with too many emails (likely large)

async function discoverLeadsWithHunterIO(
  context: JobContext,
  existingLeadCount: number,
  existingDomains: Set<string>,
): Promise<HunterDiscoveredLead[]> {
  const leads: HunterDiscoveredLead[] = []

  // 1. Generate Hunter.io params via LLM (two-step)
  const baseParams = await generateHunterioQuery(context.surveyData)

  let offset = 0
  let hasMoreResults = true

  // 2. Paginate until target reached or no more results
  while (hasMoreResults && (existingLeadCount + leads.length) < TARGET_LEADS) {
    const params = { ...baseParams, limit: HUNTERIO_MAX_PER_PAGE, offset }
    const companies = await searchLeadsWithHunter(params)

    if (companies.length === 0) {
      hasMoreResults = false
      break
    }

    // 3. Process each company
    for (const company of companies) {
      if (existingDomains.has(company.domain)) continue // Skip duplicates

      // Skip big companies (proxy: too many emails indexed)
      if (company.emailsCount.total > HUNTERIO_MAX_EMAIL_COUNT) continue

      // 4. Get emails via Domain Search API (rate-limited)
      const emailResult = await searchDomainWithHunter({ domain: company.domain })

      if (emailResult.genericEmail) {
        leads.push({
          companyName: company.organization,
          websiteUrl: `https://${company.domain}`,
          primaryEmail: emailResult.genericEmail,
          leadSource: "hunterio-discover",
        })
        existingDomains.add(company.domain)
      }

      // Check if target reached
      if ((existingLeadCount + leads.length) >= TARGET_LEADS) break
    }

    offset += HUNTERIO_MAX_PER_PAGE

    if (companies.length < HUNTERIO_MAX_PER_PAGE) {
      hasMoreResults = false
    }
  }

  return leads
}
```

### 3. Integration in runDiscoveryPhase

**File:** `elysia-server/src/services/onboarding-worker.service.ts`

```typescript
// After existing BigQuery discovery
const afterBigQueryCount = await countLeadsWithEmails(workspaceId)

if (afterBigQueryCount < TARGET_LEADS) {
  console.log("[DiscoveryPhase] Starting Hunter.io fallback discovery")

  // Hunter.io fallback
  const hunterLeads = await discoverLeadsWithHunterIO(
    context,
    afterBigQueryCount,
    processedWebsites
  )

  if (hunterLeads.length > 0) {
    // Save Hunter.io discovered leads
    await bulkCreateLeads({
      workspaceId,
      leads: hunterLeads.map(lead => ({
        ...lead,
        leadStatus: "new",
      })),
      createdBy: userId,
    })
  }
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `elysia-server/src/services/hunterio-query-generator.service.ts` | Two-step LLM query generator (GPT-4o + GPT-4o-mini) |
| `elysia-server/src/services/onboarding-worker.service.ts` | Add `discoverLeadsWithHunterIO()`, modify `runDiscoveryPhase()` |

## Key Considerations

### Rate Limiting
- **Discover API**: 50/min, 5/sec (handled by `searchLeadsWithHunter`)
- **Domain Search API**: 500/min, 15/sec (handled by `searchDomainWithHunter`)

### Caching
Both Discover and Domain Search APIs use Redis caching (24-hour TTL).

### Cost
Each Domain Search call costs credits. With pagination to 250 leads, worst case ~250 Domain Search calls.

### Company Size Filtering
Companies with >100 indexed emails are skipped as a proxy for large companies (>1000 employees).

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    STEP 1: BigQuery                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  BigQuery   │───▶│   Enrich    │───▶│  Save to DB │  │
│  │   Search    │    │   Emails    │    │             │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                         │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ Lead count < 250│
                 │       ?         │
                 └────────┬────────┘
                          │ YES
                          ▼
┌─────────────────────────────────────────────────────────┐
│               STEP 2: Hunter.io Fallback                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌─────────────┐                     │
│  │ Survey Data │───▶│ GPT-5.1     │                     │
│  │             │    │ (Strategy)  │                     │
│  └─────────────┘    └──────┬──────┘                     │
│                            │                            │
│                            ▼                            │
│                   ┌─────────────────┐                   │
│                   │ GPT-4o-mini     │                   │
│                   │ (Structured     │                   │
│                   │  Extraction)    │                   │
│                   └────────┬────────┘                   │
│                            │                            │
│                            ▼                            │
│                   ┌─────────────────┐                   │
│                   │ Hunter.io       │◄─── Pagination    │
│                   │ Discover API    │                   │
│                   └────────┬────────┘                   │
│                            │                            │
│                            ▼                            │
│                   ┌─────────────────┐                   │
│                   │ Skip big        │                   │
│                   │ companies       │                   │
│                   │ (>100 emails)   │                   │
│                   └────────┬────────┘                   │
│                            │                            │
│                            ▼                            │
│                   ┌─────────────────┐                   │
│                   │ Hunter.io       │                   │
│                   │ Domain Search   │                   │
│                   │ (rate-limited)  │                   │
│                   └────────┬────────┘                   │
│                            │                            │
│                            ▼                            │
│                   ┌─────────────────┐                   │
│                   │ Deduplicate &   │                   │
│                   │ Save to DB      │                   │
│                   └─────────────────┘                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Related Files

- `elysia-server/src/services/hunterio-lead-search.service.ts` - Hunter.io Discover API wrapper
- `elysia-server/src/services/hunterio-domain-search.service.ts` - Hunter.io Domain Search (rate-limited)
- `elysia-server/src/services/hunterio-query-generator.service.ts` - Two-step LLM query generator
- `elysia-server/src/workers/bullmq/onboarding-auto-generate.worker.ts` - BullMQ worker
