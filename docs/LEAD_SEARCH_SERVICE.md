# Lead Search & Enrichment Service

A unified, testable service for discovering and enriching leads with built-in filtering and fallback logic.

## Overview

This service separates the **business logic** of lead discovery from **database operations**, making it:
- ✅ **Testable** - Can be tested without database dependencies
- ✅ **Reusable** - Can be used in different contexts (onboarding, manual search, batch jobs)
- ✅ **Maintainable** - Single source of truth for search logic
- ✅ **Observable** - Built-in progress tracking

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Lead Search & Enrichment Service                │
│                                                           │
│  ┌──────────────┐      ┌──────────────┐                │
│  │   BigQuery   │──┬──→│  Enrichment  │──→ Leads       │
│  │   Search     │  │   │   (Hunter)   │                │
│  └──────────────┘  │   └──────────────┘                │
│                    │                                     │
│                    │   ┌──────────────┐                │
│                    └──→│  Hunter.io   │──→ More Leads  │
│                        │   Fallback   │                │
│                        └──────────────┘                │
└─────────────────────────────────────────────────────────┘
         ↓ Returns enriched leads (no DB save)
         ↓
┌─────────────────────────────────────────────────────────┐
│             Consumer (Worker/API/Script)                 │
│                                                           │
│  • Onboarding Worker → saves to DB + SSE                │
│  • Manual Search API → returns to frontend              │
│  • Batch Job → processes in bulk                        │
└─────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. **Two-Tier Search Strategy**
- **Primary**: BigQuery (Apollo dataset) - Fast, comprehensive
- **Fallback**: Hunter.io Discovery - Activates if < target count

### 2. **Smart Filtering**
- ✅ Duplicate domain detection
- ✅ Large company exclusion (>5000 employees)
- ✅ Invalid email filtering
- ✅ Cross-source deduplication

### 3. **Progress Tracking**
- Real-time progress callbacks
- Phase tracking (bigquery → enrichment → hunterio → complete)
- Current count vs target count

### 4. **Detailed Statistics**
- Total leads found
- Leads from each source
- Duplicates skipped
- Large companies skipped
- Leads with valid emails

---

## Usage

### Basic Usage

```typescript
import { searchAndEnrichLeads } from "./services/lead-search-enrichment.service"

const result = await searchAndEnrichLeads(
  150, // target lead count
  "Software companies in United States" // natural language query
)

console.log(`Found ${result.stats.totalFound} leads`)
console.log(`From BigQuery: ${result.stats.fromBigQuery}`)
console.log(`From Hunter.io: ${result.stats.fromHunterIO}`)

// result.leads is an array of enriched leads (ready to save to DB)
```

**Natural Language Query Examples:**
- `"Software companies in United States"`
- `"Technology startups in Japan"`
- `"Healthcare B2B companies in Germany"`
- `"E-commerce businesses in Canada"`

### With Progress Tracking

```typescript
import { searchAndEnrichLeads } from "./services/lead-search-enrichment.service"

const result = await searchAndEnrichLeads(
  150,
  "Software companies in United States",
  // Progress callback
  (progress) => {
    console.log(`[${progress.phase}] ${progress.message}`)
    console.log(`Progress: ${progress.currentCount}/${progress.targetCount}`)
  }
)
```

### Advanced: Individual Functions

```typescript
import {
  searchWithBigQuery,
  searchWithHunterIO,
  enrichLeads,
} from "./services/lead-search-enrichment.service"

// Use individual functions for custom workflows

// 1. BigQuery only
const bigQueryResult = await searchWithBigQuery({
  targetIndustries: ["Software", "Technology"],
  countryName: "United States",
  targetCount: 100,
})

// 2. Enrich leads
const enriched = await enrichLeads(bigQueryResult.leads)

// 3. Hunter.io fallback
const hunterResult = await searchWithHunterIO({
  surveyData: { industry: "software", country: "US", ... },
  existingDomains: new Set(),
  currentCount: 100,
  targetCount: 150,
})
```

---

## API Reference

### Main Function

#### `searchAndEnrichLeads(targetLeadCount, searchQuery, onProgress?)`

**Parameters:**
- `targetLeadCount: number` - Number of leads to find (e.g., 150)
- `query: string` - Natural language search query (e.g., "Software companies in United States")
- `onProgress?: ProgressCallback` - Optional progress callback

**Returns:** `Promise<SearchResult>`
```typescript
{
  leads: EnrichedLead[]  // Array of enriched leads
  stats: {
    totalFound: number
    fromBigQuery: number
    fromHunterIO: number
    skippedDuplicates: number
    skippedLargeCompanies: number
    withEmails: number
  }
}
```

**EnrichedLead Structure:**
```typescript
{
  companyName: string
  websiteUrl: string
  primaryEmail: string | null
  businessType?: string
  country?: string
  employeeCount?: string
  description?: string
  leadSource: "bigquery-auto" | "hunterio-discover"
}
```

---

## Configuration

### Search Config (Constant)

```typescript
export const SEARCH_CONFIG = {
  TARGET_LEADS: 150,              // Default target
  ENRICHMENT_BATCH_SIZE: 30,      // Enrichment batch size
  BIGQUERY_BATCH_SIZE: 100,       // Results per BigQuery query
  MAX_SEARCH_ITERATIONS: 3,       // Max BigQuery iterations
  MAX_EMPLOYEE_COUNT: 5000,       // Skip if > 5000 employees
  HUNTERIO_MAX_PER_PAGE: 100,     // Hunter.io page size
  HUNTERIO_MAX_EMAIL_COUNT: 100,  // Skip if > 100 indexed emails
}
```

### Get Current Config

```typescript
import { getSearchConfig } from "./services/lead-search-enrichment.service"

const config = getSearchConfig()
console.log(config.TARGET_LEADS) // 150
```

---

## Testing

### Run Unit Tests

```bash
cd elysia-server
bun test test/lead-search-enrichment.test.ts
```

Tests cover:
- ✅ Filtering logic (employee count, email count, duplicates)
- ✅ Progress tracking
- ✅ Statistics calculation
- ✅ Edge cases (empty results, null values)
- ✅ Data transformations
- ✅ Batching logic

### Run Standalone Test Script

```bash
cd elysia-server
bun run scripts/test-lead-search.ts
```

This script:
- ✅ Tests the service without database
- ✅ Shows progress in real-time
- ✅ Displays sample results
- ✅ Verifies filtering works
- ✅ Reports detailed statistics

---

## Integration with Onboarding Worker

### Before (Tightly Coupled)

```typescript
// Lead search logic mixed with database operations and SSE
async function runDiscoveryPhase(job, context) {
  // ... 500+ lines of search + DB + SSE logic mixed together
}
```

### After (Separation of Concerns)

```typescript
// Pure search logic (no DB)
const result = await searchAndEnrichLeads(150, searchQuery, onProgress)

// Consumer handles DB + SSE separately
for (const lead of result.leads) {
  await saveLeadToDB(lead)
  await emitSSE(progress)
}
```

---

## Filtering Rules

### BigQuery Filtering

1. **Duplicate Domains** - Skips domains already processed
2. **Large Companies** - Skips if `employeeCount > 5000`
3. **Missing Website** - Skips if no website URL

### Hunter.io Filtering

1. **Duplicate Domains** - Skips domains from BigQuery
2. **Large Companies** - Skips if `emailsCount > 100` (proxy for size)
3. **No Generic Email** - Skips if domain search returns no email

### Post-Enrichment Filtering

1. **Invalid Emails** - Filters out `noreply@`, `postmaster@`, `abuse@`
2. **Null Emails** - Only returns leads with valid email addresses

---

## Performance

### Expected Timings (150 leads)

| Phase | Duration | Notes |
|-------|----------|-------|
| BigQuery Search | 30-90s | Depends on query complexity |
| Enrichment | 60-120s | 30 leads per batch, Hunter.io rate limited |
| Hunter.io Fallback | 60-180s | Only if < 150 from BigQuery |
| **Total** | **2-6 min** | Typical range |

### Optimization Tips

1. **Reduce Target** - Test with 10-20 leads first
2. **Adjust Batch Size** - Larger batches = fewer API calls
3. **Cache Results** - Store enriched leads for reuse
4. **Parallel Enrichment** - Consider parallel processing (with rate limiting)

---

## Error Handling

The service handles errors gracefully:

```typescript
try {
  const result = await searchAndEnrichLeads(150, query)
  // Success path
} catch (error) {
  // Error could be:
  // - BigQuery API error
  // - Hunter.io API error (rate limit, auth)
  // - Network timeout
  // - Invalid query parameters
  console.error("Search failed:", error)
}
```

### Partial Results

If Hunter.io fails, the service returns BigQuery results:

```typescript
const result = await searchAndEnrichLeads(150, query)

if (result.stats.totalFound < 150) {
  console.warn("Partial results:", result.stats.totalFound)
  // Still usable - just fewer leads
}
```

---

## Examples

### Example 1: Onboarding Worker

```typescript
import { searchAndEnrichLeads } from "./services/lead-search-enrichment.service"
import { bulkCreateLeads } from "./services/lead.service"

async function runDiscoveryPhase(job, context) {
  const { workspaceId, userId, surveyData } = context

  // Construct natural language query from survey data
  const query = `${surveyData.industry} companies in ${surveyData.country}`

  // Search and enrich (pure business logic)
  const result = await searchAndEnrichLeads(
    150,
    query,
    async (progress) => {
      // Emit SSE updates
      await emitSSE(progress)
      // Update job progress
      await job.updateProgress(progress)
    }
  )

  // Save to database (separate concern)
  const { stats } = await bulkCreateLeads({
    workspaceId,
    leads: result.leads.map(lead => ({
      companyName: lead.companyName,
      websiteUrl: lead.websiteUrl,
      primaryEmail: lead.primaryEmail,
      leadSource: lead.leadSource,
      leadStatus: "new",
    })),
    createdBy: userId,
  })

  return { leadIds: stats.created, count: result.stats.totalFound }
}
```

### Example 2: Manual Search API

```typescript
import { searchAndEnrichLeads } from "./services/lead-search-enrichment.service"

app.post("/api/v1/leads/search", async ({ body }) => {
  const { targetCount, query } = body

  // Search without saving to DB
  const result = await searchAndEnrichLeads(targetCount, query)

  // Return to frontend
  return {
    leads: result.leads,
    stats: result.stats,
  }
})
```

### Example 3: Batch Processing

```typescript
import { searchAndEnrichLeads } from "./services/lead-search-enrichment.service"

async function batchProcessIndustries(industries: string[]) {
  const allResults = []

  for (const industry of industries) {
    const query = `${industry} companies in United States`
    const result = await searchAndEnrichLeads(50, query)

    allResults.push({
      industry,
      leadsFound: result.stats.totalFound,
      leads: result.leads,
    })

    // Process or save batch
    await processBatch(result.leads)
  }

  return allResults
}
```

---

## Troubleshooting

### Issue: No leads found

**Check:**
1. Query parameters are valid
2. BigQuery credentials configured
3. Hunter.io API key valid
4. Industry/country combination has data

### Issue: Only BigQuery results, no Hunter.io fallback

**Cause:** BigQuery already found target count

**Solution:** This is expected behavior! Hunter.io only triggers if BigQuery < target.

### Issue: Many duplicates skipped

**Cause:** Multiple queries returning same companies

**Solution:** Normal behavior. Deduplication is working correctly.

### Issue: All companies filtered as "too large"

**Check:**
1. `MAX_EMPLOYEE_COUNT` threshold (default: 5000)
2. Industry targeting (enterprises vs SMBs)
3. Query specificity

---

## Related Files

- **Service**: `elysia-server/src/services/lead-search-enrichment.service.ts`
- **Tests**: `elysia-server/test/lead-search-enrichment.test.ts`
- **Test Script**: `elysia-server/scripts/test-lead-search.ts`
- **Worker Integration**: `elysia-server/src/services/onboarding-worker.service.ts`

---

## Future Enhancements

### Potential Improvements

1. **Caching Layer** - Cache enriched leads to avoid re-enrichment
2. **Parallel Enrichment** - Process multiple batches in parallel
3. **Custom Filters** - Allow consumers to pass custom filter functions
4. **Resume Support** - Resume from partial results
5. **Rate Limit Handling** - Better backoff/retry for API limits
6. **Data Quality Scoring** - Score leads by completeness/validity

### API Extensions

```typescript
// Future: Custom filters
await searchAndEnrichLeads(150, query, {
  customFilter: (lead) => lead.employeeCount > 100 && lead.employeeCount < 1000,
  minEmailQuality: 0.8,
})

// Future: Resume from checkpoint
await searchAndEnrichLeads(150, query, {
  resumeFrom: previousResult.checkpoint,
})
```

---

## Changelog

### v1.0.0 (Current)
- ✅ Extracted from onboarding worker
- ✅ Pure function with no DB dependencies
- ✅ Comprehensive unit tests
- ✅ Progress tracking support
- ✅ Detailed statistics
- ✅ Filtering for duplicates and large companies

---

## Support

For questions or issues:
1. Check test output: `bun run scripts/test-lead-search.ts`
2. Review unit tests: `test/lead-search-enrichment.test.ts`
3. Enable debug logging: `DEBUG=true bun run scripts/test-lead-search.ts`
