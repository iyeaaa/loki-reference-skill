# Lead Scoring Service

AI-powered lead scoring service that evaluates how well leads match search criteria using GPT-4o-mini.

## Overview

The lead scoring service provides a standardized way to evaluate lead quality by comparing lead data against search queries. It returns a score from 0-100 along with reasoning, making it easy to prioritize and filter leads.

## Features

- **AI-Powered Scoring**: Uses OpenAI's GPT-4o-mini for intelligent lead evaluation
- **Redis Caching**: 24-hour TTL with instant cache hits (~0ms vs ~1800ms for LLM)
- **Structured Output**: Returns numeric scores (0-100) with detailed reasoning
- **Batch Processing**: Efficiently score multiple leads in sequence
- **Error Handling**: Graceful fallbacks with neutral scores on failures
- **Helper Functions**: Utilities for formatting lead data
- **Cache Management**: Functions to check cache status and clear entries

## Installation

The service is located at:
```
elysia-server/src/services/lead-scoring.service.ts
```

Dependencies:
- `@langchain/openai` - OpenAI integration
- `zod` - Schema validation

## Usage

### Basic Scoring

```typescript
import { scoreLeadFit } from "./services/lead-scoring.service"

const score = await scoreLeadFit(
  "Software companies in United States",
  "Company: Acme Corp | Industry: Software Development | Country: United States | Employees: 50"
)

console.log(score)
// {
//   score: 95,
//   reasoning: "Exact match on industry and country, appropriate company size"
// }
```

### Using Helper Function

```typescript
import { scoreLeadFit, formatLeadForScoring } from "./services/lead-scoring.service"

const lead = {
  companyName: "TechStart Inc",
  industry: "Technology",
  country: "United States",
  employeeCount: "25",
  description: "Innovative tech startup",
  websiteUrl: "https://techstart.com"
}

const leadData = formatLeadForScoring(lead)
const score = await scoreLeadFit("Technology startups in Japan", leadData)

console.log(`Score: ${score.score}/100`)
console.log(`Reason: ${score.reasoning}`)
```

### Batch Scoring

```typescript
import { scoreLeadsBatch, formatLeadForScoring } from "./services/lead-scoring.service"

const leads = [
  { companyName: "Company A", industry: "Manufacturing", country: "UK" },
  { companyName: "Company B", industry: "Software", country: "UK" },
  { companyName: "Company C", industry: "Manufacturing", country: "France" },
]

const leadDataArray = leads.map(formatLeadForScoring)

const scores = await scoreLeadsBatch(
  "Manufacturing companies in United Kingdom",
  leadDataArray,
  (completed, total) => {
    console.log(`Progress: ${completed}/${total}`)
  }
)

scores.forEach((score, index) => {
  console.log(`Lead ${index + 1}: ${score.score}/100 - ${score.reasoning}`)
})
```

## API Reference

### `scoreLeadFit(query: string, leadData: string): Promise<LeadScore>`

Score a single lead against search criteria with automatic caching.

**Parameters:**
- `query` - Natural language search query (e.g., "Software companies in United States")
- `leadData` - String representation of lead information

**Returns:**
```typescript
{
  score: number    // 0-100, where 100 is perfect match
  reasoning: string // Brief explanation of the score
}
```

**Performance:**
- Cache miss: ~1800ms (LLM call)
- Cache hit: ~0-1ms (Redis)
- Cache TTL: 24 hours

### `scoreLeadsBatch(query: string, leads: string[], onProgress?: Function): Promise<LeadScore[]>`

Score multiple leads in batch.

**Parameters:**
- `query` - Natural language search query
- `leads` - Array of lead data strings
- `onProgress` - Optional callback `(completed: number, total: number) => void`

**Returns:** Array of `LeadScore` objects matching input order

### `formatLeadForScoring(lead: object): string`

Convert structured lead object to string format for scoring.

**Parameters:**
- `lead` - Object with optional fields: `companyName`, `industry`, `country`, `employeeCount`, `description`, `websiteUrl`

**Returns:** Formatted string (e.g., `"Company: Acme | Industry: Software | Country: US"`)

### `isCacheEnabled(): boolean`

Check if Redis caching is enabled.

**Returns:** `true` if caching is enabled, `false` otherwise

### `clearCacheEntry(query: string, leadData: string): Promise<void>`

Clear a specific cache entry for a query/lead combination.

**Parameters:**
- `query` - Search query used for scoring
- `leadData` - Lead data string used for scoring

**Use Case:** Useful for testing or when you need to force re-scoring

## Scoring Guidelines

The AI evaluates leads based on the following criteria:

### Score Ranges

- **90-100**: Excellent match - Industry, location, and company characteristics align perfectly
- **70-89**: Good match - Most criteria match with minor deviations
- **50-69**: Moderate match - Some criteria match but significant differences exist
- **30-49**: Poor match - Few criteria match, major differences
- **0-29**: Very poor match - Does not match the search criteria

### Scoring Factors

1. **Industry Match (40% weight)**: Does the lead's industry/business type match the query?
2. **Location Match (30% weight)**: Does the lead's country/region match the query?
3. **Company Size (20% weight)**: Is the company size appropriate for the context?
4. **Other Attributes (10% weight)**: Any additional relevant matching factors

## Examples

### Example 1: Perfect Match

```typescript
Query: "Software companies in United States"
Lead: "Company: Acme Software | Industry: Software Development | Country: United States | Employees: 50"

Result:
{
  score: 95,
  reasoning: "Perfect industry and location match, appropriate size"
}
```

### Example 2: Partial Match

```typescript
Query: "Technology startups in Japan"
Lead: "Company: TechStart | Industry: Technology | Country: United States | Employees: 25"

Result:
{
  score: 30,
  reasoning: "Industry matches but located in wrong country (US vs Japan)"
}
```

### Example 3: Poor Match

```typescript
Query: "Healthcare providers in Germany"
Lead: "Company: Auto Parts Ltd | Industry: Automotive | Country: Germany | Employees: 500"

Result:
{
  score: 30,
  reasoning: "Location matches but completely wrong industry (Automotive vs Healthcare)"
}
```

## Testing

### Basic Functionality Test

Run the test script to verify the service:

```bash
bun run scripts/test-lead-scoring.ts
```

The test includes:
- Perfect match scenario
- Partial match (different country)
- Poor match (wrong industry)
- Batch scoring with multiple leads

### Cache Performance Test

Run the cache test to verify caching works:

```bash
bun run scripts/test-lead-scoring-cache.ts
```

The cache test validates:
- Cache miss (first call) takes ~1800ms
- Cache hit (second call) takes ~0-1ms
- Different leads have different cache keys
- Cache clear functionality works
- Multiple cache entries can coexist

**Expected Results:**
```
Cache enabled: true
Test 1: First call (cache miss)
   Time: 1793ms (LLM call)

Test 2: Second call (cache hit)
   Time: 0ms (from cache)
   Speedup: ~1800x faster
```

## Performance

- **Cache Hit**: ~0-1ms (instant from Redis)
- **Cache Miss**: ~1500-2000ms (GPT-4o-mini inference)
- **Speedup**: ~1800x faster with caching
- **Cost**: ~$0.000015 per request (only on cache miss)
- **Cache TTL**: 24 hours
- **Batch Processing**: Sequential to avoid rate limits
- **Error Recovery**: Automatic fallback to neutral scores

### Caching Strategy

The service uses Redis for intelligent caching:

1. **Cache Key Generation**: SHA256 hash of `query + leadData`
2. **Automatic Caching**: All successful scores are cached automatically
3. **Cache Validation**: Scores are validated with Zod before caching
4. **TTL Management**: Entries expire after 24 hours
5. **Error Handling**: Cache failures don't affect scoring (graceful degradation)

## Error Handling

The service includes comprehensive error handling:

1. **JSON Parsing Failures**: Attempts multiple extraction strategies
2. **API Errors**: Returns neutral score (50) with error message
3. **Invalid Input**: Validates using Zod schemas
4. **Rate Limiting**: Sequential batch processing to avoid limits

## Integration Examples

### With Lead Search Service

```typescript
import { searchAndEnrichLeads } from "./services/lead-search-enrichment.service"
import { scoreLeadFit, formatLeadForScoring } from "./services/lead-scoring.service"

// Search for leads
const query = "Software companies in United States"
const result = await searchAndEnrichLeads(150, query)

// Score each lead
const scoredLeads = await Promise.all(
  result.leads.map(async (lead) => {
    const leadData = formatLeadForScoring(lead)
    const score = await scoreLeadFit(query, leadData)
    return { ...lead, fitScore: score.score, scoreReasoning: score.reasoning }
  })
)

// Filter high-quality leads (score >= 70)
const highQualityLeads = scoredLeads.filter(l => l.fitScore >= 70)
```

### With Filtering

```typescript
// Score and filter leads
const scores = await scoreLeadsBatch(query, leadsData)

const filteredLeads = leads
  .map((lead, i) => ({ ...lead, score: scores[i] }))
  .filter(lead => lead.score.score >= 70) // Only good matches
  .sort((a, b) => b.score.score - a.score.score) // Sort by score
```

## Configuration

The service uses environment variables from the OpenAI configuration:

- `OPENAI_API_KEY` - Required for API access

Model configuration can be adjusted in the service file:
```typescript
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",  // Can be changed to other models
  temperature: 0,         // Deterministic scoring
})
```

## Comparison with Fit Score Calculator

This service is simpler than the existing [fit-score-calculator.ts](../elysia-server/src/services/lead-discovery/fit-score-calculator.ts):

| Feature | Lead Scoring Service | Fit Score Calculator |
|---------|---------------------|---------------------|
| **Purpose** | Query-based scoring | Complex lead evaluation |
| **Input** | Query + lead string | Detailed lead objects + context |
| **Caching** | Redis (24hr TTL) | Redis + LRU cache |
| **Complexity** | Simple (270 LOC) | Complex (1200+ LOC) |
| **Use Case** | Quick scoring | Production lead discovery |
| **Policies** | None | Website verification, email validation |
| **Performance** | 0-1ms (cached) / 1800ms (uncached) | Varies with policies |

**When to use Lead Scoring Service:**
- Simple query-based lead evaluation
- Prototyping and testing
- One-off scoring needs

**When to use Fit Score Calculator:**
- Production lead discovery workflow
- Need caching and performance optimization
- Complex evaluation with policies

## Future Enhancements

Potential improvements:
- [x] ~~Add Redis caching for repeated queries~~ ✅ Done (24hr TTL)
- [ ] Batch API calls for better performance (currently sequential)
- [ ] Support for custom scoring weights
- [ ] Integration with lead enrichment pipeline
- [ ] Async parallel scoring with concurrency limits
- [ ] Score explanation with specific factor breakdowns
- [ ] LRU in-memory cache layer before Redis
- [ ] Cache warming strategies for common queries
- [ ] Cache statistics and monitoring

## Related Documentation

- [Lead Search & Enrichment Service](./LEAD_SEARCH_SERVICE.md)
- [Hunter.io Integration](./LEAD_SEARCH_QUICK_REFERENCE.md)
- [Fit Score Calculator](../elysia-server/src/services/lead-discovery/fit-score-calculator.ts)
