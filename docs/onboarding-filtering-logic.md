# Onboarding Lead Discovery Filtering Logic

## Overview

The onboarding worker implements a two-tier lead discovery system (BigQuery → Hunter.io fallback) with **filtering at both stages** to target SMBs and avoid duplicate/invalid leads.

**Target**: 150 leads with emails → 450 total emails (3-touch sequence)

---

## Filtering Constants

```typescript
const TARGET_LEADS = 150              // Target lead count
const MAX_EMPLOYEE_COUNT = 5000       // Skip companies > 5000 employees
const HUNTERIO_MAX_EMAIL_COUNT = 100  // Skip if > 100 indexed emails (proxy for large companies)
```

---

## Phase 1: BigQuery Lead Discovery

### Data Source
- **Apollo Dataset** via Google BigQuery
- Searches 1-3 target B2B customer industries
- 3 iterations max, 100 results per query

### Filters Applied

#### Filter 1: Duplicate Domain Check
```typescript
if (processedWebsites.has(website.toLowerCase())) {
  continue // Skip duplicate
}
```
- Prevents duplicate leads across multiple queries
- Uses `processedWebsites` Set to track all domains

#### Filter 2: Large Company Exclusion ✨ NEW
```typescript
const employeeCount = parseInt(row.employees?.toString() || "0", 10)
if (employeeCount > MAX_EMPLOYEE_COUNT) { // > 5000
  console.log(`Skipping large company (${employeeCount} employees): ${row.company}`)
  continue
}
```
- **Purpose**: Target SMBs for better conversion rates
- **Threshold**: 5000 employees
- **Reasoning**: Large enterprises (>5000) have longer sales cycles, complex procurement processes, and lower conversion rates

#### Filter 3: Missing Website
```typescript
if (!website) continue
```
- Skips leads without a website URL
- Website required for enrichment process

### Output
- Filtered companies added to enrichment queue (batches of 30)
- Each batch enriched via Hunter.io Domain Search + AI analysis

---

## Phase 2: Hunter.io Fallback (if < 150 leads)

**Triggers when**: `afterBigQueryCount < TARGET_LEADS`

### Data Source
- **Hunter.io Lead Discovery API** - finds companies
- **Hunter.io Domain Search API** - gets emails per company

### Filters Applied

#### Filter 1: Duplicate Domain Check
```typescript
if (existingDomains.has(company.domain.toLowerCase())) {
  console.log(`Skipping duplicate domain: ${company.domain}`)
  continue
}
```
- Reuses same `existingDomains` Set from BigQuery phase
- Prevents duplicate leads between BigQuery and Hunter.io

#### Filter 2: Large Company Exclusion (Email Count Proxy)
```typescript
if (company.emailsCount.total > HUNTERIO_MAX_EMAIL_COUNT) { // > 100
  console.log(`Skipping large company (${company.emailsCount.total} emails): ${company.organization}`)
  continue
}
```
- **Purpose**: Filter out enterprises using indexed email count as proxy
- **Threshold**: 100 indexed emails
- **Reasoning**: Companies with 100+ indexed emails in Hunter.io are typically large enterprises
- **Correlation**: High email count ≈ >5000 employees

### Output
- Valid leads saved to DB with `leadSource: "hunterio-discover"`

---

## Comparison: BigQuery vs Hunter.io Filtering

| Filter | BigQuery | Hunter.io | Method |
|--------|----------|-----------|--------|
| **Duplicate Domain** | ✅ | ✅ | `processedWebsites` Set |
| **Large Company** | ✅ Employee count > 5000 | ✅ Email count > 100 | Direct vs Proxy |
| **Missing Data** | ✅ No website → skip | ✅ No generic email → skip | Required fields |

---

## Why Target SMBs?

### Business Reasons
1. **Higher Conversion Rates** - Shorter sales cycles, faster decisions
2. **Better Response Rates** - More accessible decision makers
3. **Product-Market Fit** - Trial/demo products suited for SMB budgets
4. **Relationship Building** - Easier to build direct relationships

### Threshold Justification
- **5000 employees** = clear enterprise threshold
  - Forbes 500, Fortune 1000 companies
  - Complex procurement processes
  - Multiple approval layers
- **100 indexed emails** (Hunter.io proxy)
  - Correlates strongly with company size
  - Cost-effective proxy without requiring employee count API call

---

## Logging & Observability

### BigQuery Phase Logs
```
[DiscoveryPhase] Found 100 results for "Software"
[DiscoveryPhase] Skipping large company (8500 employees): Acme Corp
[DiscoveryPhase] Added 85 new leads from "Software" (10 duplicates, 5 large companies skipped)
```

### Hunter.io Phase Logs
```
[HunterIO Discovery] Starting fallback discovery. Current leads: 120, Target: 150
[HunterIO Discovery] Skipping duplicate domain: example.com
[HunterIO Discovery] Skipping large company (250 emails): BigTech Inc
[HunterIO Discovery] Added lead: StartupCo (contact@startupco.com)
[HunterIO Discovery] Complete. Found 30 new leads.
```

---

## Flow Diagram

See: [docs/onboarding-worker-flow-simple.puml](./onboarding-worker-flow-simple.puml)

**Phase 1: BigQuery**
```
Search → Filter duplicates → Filter large (>5000) → Enrich → Save
```

**Phase 2: Hunter.io Fallback** (if < 150)
```
Discover → Filter duplicates → Filter large (>100 emails) → Get Email → Save
```

---

## Configuration

To adjust filtering thresholds, modify constants in:
```
elysia-server/src/services/onboarding-worker.service.ts
```

```typescript
const TARGET_LEADS = 150              // Adjust lead target
const MAX_EMPLOYEE_COUNT = 5000       // Adjust company size threshold
const HUNTERIO_MAX_EMAIL_COUNT = 100  // Adjust Hunter.io proxy threshold
```

---

## Related Files

- **Worker Service**: `elysia-server/src/services/onboarding-worker.service.ts`
- **BigQuery Search**: `elysia-server/src/services/bigquery-search.service.ts`
- **Hunter.io Discovery**: `elysia-server/src/services/hunterio-lead-search.service.ts`
- **Hunter.io Domain Search**: `elysia-server/src/services/hunterio-domain-search.service.ts`
- **Flow Diagram**: `docs/onboarding-worker-flow-simple.puml`

---

## Testing

To verify filtering is working:

1. **Check logs** for "Skipping large company" messages
2. **Query database** for lead distribution:
   ```sql
   SELECT lead_source, COUNT(*)
   FROM leads
   WHERE workspace_id = 'test-workspace-id'
   GROUP BY lead_source;
   ```
3. **Verify employee counts** in saved leads:
   ```sql
   SELECT company_name, employee_count
   FROM leads
   WHERE workspace_id = 'test-workspace-id'
   ORDER BY employee_count DESC
   LIMIT 20;
   ```

All should show employee_count ≤ 5000 for new leads.
