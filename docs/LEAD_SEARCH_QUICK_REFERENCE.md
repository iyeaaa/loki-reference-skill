# Lead Search & Enrichment - Quick Reference

## 🚀 Quick Start

```bash
# Run unit tests (fast, no APIs)
bun test test/lead-search-enrichment.test.ts

# Run with real APIs (slower, full test)
bun run scripts/test-lead-search.ts
```

## 📝 Basic Usage

```typescript
import { searchAndEnrichLeads } from "./services/lead-search-enrichment.service"

const result = await searchAndEnrichLeads(
  150,  // target count
  "Software companies in United States"  // natural language query
)

console.log(`Found ${result.stats.totalFound} leads`)
```

## 📊 Result Structure

```typescript
{
  leads: [
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
  ],
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

## 🎯 With Progress Tracking

```typescript
await searchAndEnrichLeads(
  150,
  "Software companies in United States",
  (progress) => {
    console.log(`[${progress.phase}] ${progress.message}`)
    // Phase: bigquery → enrichment → hunterio → complete
  }
)
```

## ⚙️ Configuration

```typescript
SEARCH_CONFIG = {
  TARGET_LEADS: 150,              // Default target
  MAX_EMPLOYEE_COUNT: 5000,       // Skip if > 5000 employees
  HUNTERIO_MAX_EMAIL_COUNT: 100,  // Skip if > 100 emails
  ENRICHMENT_BATCH_SIZE: 30,      // Batch size
}
```

## 🔍 Filters Applied

**BigQuery:**
- ⊗ Duplicate domains
- ⊗ Employee count > 5000
- ⊗ Missing website

**Hunter.io:**
- ⊗ Duplicate domains (from BigQuery)
- ⊗ Email count > 100 (proxy for large companies)
- ⊗ No generic email found

**Post-enrichment:**
- ⊗ Invalid emails (noreply@, postmaster@, abuse@)
- ⊗ Null emails

## 🧪 Testing Checklist

```bash
# 1. Unit tests (< 1s)
bun test test/lead-search-enrichment.test.ts

# 2. Standalone script (2-6 min with 150 leads)
bun run scripts/test-lead-search.ts

# 3. Reduce target for faster testing
# Edit scripts/test-lead-search.ts: TARGET_LEADS = 10
bun run scripts/test-lead-search.ts  # ~30-60s
```

## 📚 Full Documentation

- **API Reference**: `docs/LEAD_SEARCH_SERVICE.md`
- **Refactoring Summary**: `docs/REFACTORING_SUMMARY.md`
- **Service Code**: `src/services/lead-search-enrichment.service.ts`
- **Tests**: `test/lead-search-enrichment.test.ts`
- **Test Script**: `scripts/test-lead-search.ts`

## ⚡ Performance

| Target | Duration | Notes |
|--------|----------|-------|
| 10 leads | 30-60s | Quick test |
| 50 leads | 1-2 min | Medium test |
| 150 leads | 2-6 min | Full test |

## 🐛 Troubleshooting

**No leads found?**
- Check BigQuery credentials
- Verify Hunter.io API key
- Try different industry/country combo

**All filtered as "too large"?**
- Lower `MAX_EMPLOYEE_COUNT` threshold
- Target more specific industries (e.g., "startups" instead of "enterprises")

**Only BigQuery results?**
- Normal if BigQuery found target count
- Hunter.io only triggers as fallback

## 🎓 Examples

**Onboarding Worker:**
```typescript
const query = `${surveyData.industry} companies in ${surveyData.country}`
const result = await searchAndEnrichLeads(150, query)
await saveToDatabase(result.leads)
```

**API Endpoint:**
```typescript
app.post("/search", async ({ body }) => {
  const result = await searchAndEnrichLeads(body.count, body.query)
  return { leads: result.leads }
})
```

**Batch Processing:**
```typescript
for (const query of queries) {
  const result = await searchAndEnrichLeads(50, query)
  await processBatch(result.leads)
}
```

## ✅ Key Benefits

- ✅ **No database needed** for testing
- ✅ **Reusable** across different contexts
- ✅ **Fully tested** with unit tests
- ✅ **Progress tracking** built-in
- ✅ **Smart filtering** (duplicates, large companies)
- ✅ **Two-tier search** (BigQuery + Hunter.io fallback)
