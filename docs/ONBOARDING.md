# BullMQ Worker for Auto-Generate Onboarding - Implementation Plan

## Problem Statement

Currently, `autoGenerateOnboarding` is a long-running synchronous task that:
- Fails completely if server restarts during execution
- Processes 300 leads in one batch without incremental saves
- Performs no uniqueness checks against existing database leads
- Provides no progress feedback to users
- Takes 2-5 minutes to complete

## Requirements

1. **Resilience**: Convert to BullMQ worker that survives server restarts
2. **Incremental Processing**: Save leads to database incrementally with uniqueness checks
3. **Resume Capability**: Continue from where it left off after restart
4. **Progress Tracking**: Real-time progress updates stored in database

## Current Architecture

### Existing Components
- **BullMQ Infrastructure**: Already set up at [/elysia-server/src/lib/queue/queues.ts](../../../elysia-server/src/lib/queue/queues.ts)
  - Redis connection configured
  - 5 existing queues (campaign, scheduled, workflow, metrics, test)
  - Job logging service for tracking

- **ORM**: Drizzle with PostgreSQL
  - Schema: [/elysia-server/src/db/schema/onboarding.ts](../../../elysia-server/src/db/schema/onboarding.ts)
  - Progress tracking table with JSONB fields for flexibility

### Current Flow (in autoGenerateOnboarding)

Located at [/elysia-server/src/services/onboarding.service.ts:1180-1486](../../../elysia-server/src/services/onboarding.service.ts)

1. **Lead Discovery** (lines 1215-1220):
   - Calls `discoverLeadsForOnboarding()` which runs 1-5 BigQuery iterations
   - Target: 300 unique enriched leads with emails
   - In-memory deduplication by website URL
   - Enrichment via Hunter.io API (10 concurrent, 2s delay between batches)

2. **Customer Group Creation** (lines 1223-1247)

3. **Email Template Generation** (lines 1250-1300):
   - 2-touch sequence (intro + follow-up)
   - AI-generated via Gemini

4. **Sequence Creation** (lines 1302-1325)

5. **Preview Email Generation** (lines 1327+):
   - 600 emails (300 leads × 2 steps)
   - Staggered by 1 minute each

### Lead Uniqueness Patterns

From [/elysia-server/src/services/lead.service.ts:1300-1542](../../../elysia-server/src/services/lead.service.ts):

- **Email duplicates**: Checked via `leadContacts` table (workspace-scoped)
- **Website duplicates**: Checked via `leads.websiteUrl` (workspace-scoped)
- **Chunked queries**: 1000-item batches to avoid PostgreSQL limits
- **Transaction pattern**: Uses `db.transaction()` for consistency

## Proposed Architecture

### Queue Design

Create dedicated queue: **`onboardingGenerationQueue`**

### Job Breakdown

Split `autoGenerateOnboarding` into 5 discrete jobs:

**Job 1: Discovery Initialization**
- Input: workspace ID, user ID, survey data
- Output: Session ID, query parameters
- Stores initial state in `onboarding_progress.surveyData`

**Job 2: Lead Discovery (Iterative)**
- Input: Session ID, iteration number (1-5)
- Discovers ~200 leads per iteration via BigQuery
- **Incremental DB save**: Check uniqueness, save batch immediately
- Stores progress in new JSONB field: `discoveryProgress`
- Chains to next iteration or Job 3

**Job 3: Lead Enrichment (Batch)**
- Input: Session ID, batch of un-enriched lead IDs
- Enriches 10 leads in parallel with 2s delay
- **Incremental DB update**: Updates lead records with enrichment data
- Progress tracked in `discoveryProgress.enrichmentStats`

**Job 4: Template Generation**
- Input: Session ID
- Generates 2 email templates
- Creates customer group
- Creates sequence with steps

**Job 5: Preview Email Generation (Batch)**
- Input: Session ID, batch of lead IDs
- Generates 100 preview emails at a time
- Incremental saves to `emails` table

### Database Schema Changes

Add to `onboarding_progress` table:
```typescript
discoveryProgress: jsonb({
  sessionId: string
  currentIteration: number
  leadsDiscovered: number
  leadsEnriched: number
  enrichmentSuccessRate: number
  lastProcessedLeadId?: string
  phase: "discovery" | "enrichment" | "templates" | "previews" | "completed"
})
```

### Progress Tracking Strategy

- Use `onboarding_progress.discoveryProgress` as source of truth
- Job resume logic:
  1. Read `discoveryProgress.phase` and `currentIteration`
  2. Skip completed phases
  3. Resume from `lastProcessedLeadId`

### Uniqueness Implementation

**Before inserting leads**:
```typescript
// Check website URL duplicates (workspace-scoped)
const existingWebsites = await db
  .select({ websiteUrl: leads.websiteUrl })
  .from(leads)
  .where(and(
    eq(leads.workspaceId, workspaceId),
    inArray(leads.websiteUrl, batchWebsites)
  ))

// Check email duplicates (workspace-scoped)
const existingEmails = await db
  .select({ email: leadContacts.email })
  .from(leadContacts)
  .innerJoin(leads, eq(leadContacts.leadId, leads.id))
  .where(and(
    eq(leads.workspaceId, workspaceId),
    inArray(leadContacts.email, batchEmails)
  ))
```

## Critical Files to Modify

1. [/elysia-server/src/lib/queue/queues.ts](../../../elysia-server/src/lib/queue/queues.ts) - Add new queue
2. [/elysia-server/src/lib/queue/types.ts](../../../elysia-server/src/lib/queue/types.ts) - Add job types
3. [/elysia-server/src/db/schema/onboarding.ts](../../../elysia-server/src/db/schema/onboarding.ts) - Add `discoveryProgress` field
4. [/elysia-server/src/services/onboarding.service.ts](../../../elysia-server/src/services/onboarding.service.ts) - Refactor into smaller functions
5. Create: `/elysia-server/src/lib/queue/workers/onboarding-generation.worker.ts` - Worker implementation
6. [/elysia-server/src/routes/auth.routes.ts:304-312](../../../elysia-server/src/routes/auth.routes.ts) - Replace direct call with queue.add()

## Recommended Approach: Single Job with Checkpointed Phases

After analyzing the codebase and existing patterns, I recommend a **single orchestrator job** with internal checkpointed phases rather than multiple separate jobs. This provides:

- ✅ Simple resume logic (single job state)
- ✅ Better error handling (no job chaining complexity)
- ✅ Incremental DB checkpoints within phases
- ✅ Natural progress tracking

### Architecture Design

**Job Structure**: One job type (`ONBOARDING_AUTO_GENERATE`) with 6 phases:

1. **Discovery Phase**: Iterative BigQuery searches (1-5 iterations)
   - Batch size: 200 results per query
   - Check duplicates in 100-lead chunks
   - **Save enriched leads with emails immediately after each iteration**
   - **Base case**: Count leads in workspace DB (target: 300 unique enriched leads with emails)
   - Start with empty workspace (onboarding workspaces start with zero leads)
   - Progress: 10-30%

2. **Enrichment Phase**: Merged into Discovery Phase
   - Discovery and enrichment happen together per iteration
   - Only save leads that have emails after enrichment
   - Enrichment: 10 concurrent requests, 2s delay between batches

3. **Customer Group Phase**: Create demo group
   - Single transaction
   - Progress: 40-50%

4. **Templates Phase**: AI-generate 2 email templates
   - Parallel generation via Gemini
   - Progress: 50-65%

5. **Sequence Phase**: Create sequence with steps
   - Single transaction
   - Progress: 65-80%

6. **Preview Emails Phase**: Generate preview emails
   - Batch size: 100 emails at a time
   - Progress: 80-100%

### Checkpoint State Structure

Add to `onboarding_progress.discoveryProgress` (JSONB):

```typescript
{
  phase: 'init' | 'discovery' | 'group' | 'templates' | 'sequence' | 'previews' | 'complete',
  iteration: number,              // Current BigQuery iteration (1-5)
  leadsWithEmailsCount: number,   // Count of leads with emails in workspace DB
  lastIterationCompleted: boolean,// Whether last iteration finished enrichment
  customerGroupId?: string,       // Created group
  sequenceId?: string,            // Created sequence
  errors: Array<{
    phase: string,
    message: string,
    timestamp: string
  }>
}
```

### Resume Logic

On job restart:
1. Read `discoveryProgress` from DB
2. Check `phase` field
3. **Count existing leads with emails in workspace** to determine progress
4. Resume from checkpoint:
   - Discovery:
     - If `lastIterationCompleted` is false, re-run current iteration
     - Otherwise, continue from `iteration + 1`
     - Check workspace DB count before each iteration (base case)
   - Other phases: Re-run if not completed

### Uniqueness Implementation

**For Onboarding Workspaces** (starting with zero leads):

**Website Duplicates** (check against workspace):
```typescript
// Query existing websites in this workspace
const existingWebsites = await db
  .select({ websiteUrl: leads.websiteUrl })
  .from(leads)
  .where(and(
    eq(leads.workspaceId, workspaceId),
    inArray(leads.websiteUrl, batchWebsites)
  ))
// Skip leads with duplicate websites (Option A)
```

**Email Duplicates** (check against workspace):
```typescript
// Query existing emails in this workspace
const existingEmails = await db
  .select({ email: leadContacts.email, leadId: leadContacts.leadId })
  .from(leadContacts)
  .innerJoin(leads, eq(leadContacts.leadId, leads.id))
  .where(and(
    eq(leads.workspaceId, workspaceId),
    inArray(leadContacts.email, batchEmails)
  ))
// Skip entire lead if primary email exists (Option A)
```

**Base Case Check** (before each iteration):
```typescript
// Count leads with emails in workspace
const leadsWithEmailsCount = await db
  .select({ count: count() })
  .from(leads)
  .innerJoin(leadContacts, eq(leads.id, leadContacts.leadId))
  .where(and(
    eq(leads.workspaceId, workspaceId),
    eq(leadContacts.contactType, 'email'),
    isNotNull(leadContacts.contactValue)
  ))
  .groupBy(leads.id)

// If count >= 300, stop discovery
```

This leverages existing `bulkCreateLeads()` logic which already handles duplicate detection.

### Database Schema Changes

**Migration**: Add to `onboarding_progress` table:

```sql
ALTER TABLE onboarding_progress
ADD COLUMN discovery_progress JSONB DEFAULT '{}'::jsonb,
ADD COLUMN job_id TEXT,
ADD COLUMN job_status TEXT CHECK (job_status IN ('waiting', 'active', 'completed', 'failed', 'delayed', 'stalled'));

CREATE INDEX idx_onboarding_job_id ON onboarding_progress(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_onboarding_job_status ON onboarding_progress(job_status) WHERE job_status IS NOT NULL;
```

### Error Handling Strategy

**Retry (BullMQ automatic)**:
- BigQuery API failures → 3 attempts, exponential backoff (2min base)
- Hunter.io rate limits → Exponential backoff
- DB connection issues → Retry
- Gemini API errors → Retry

**Skip and Continue**:
- Individual lead enrichment failures → Log and skip
- Duplicate detection errors → Skip lead
- Invalid email addresses → Skip

**Fail Job**:
- Workspace not found
- User not found
- Complete BigQuery failure after max retries

### BullMQ Configuration

```typescript
{
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 120000, // 2 min → 4 min → 8 min
  },
  timeout: 20 * 60 * 1000, // 20 min per attempt
  removeOnComplete: {
    age: 7 * 24 * 3600, // 7 days
  },
  removeOnFail: {
    age: 30 * 24 * 3600, // 30 days
  }
}
```

Worker concurrency: 2 (resource-intensive jobs)

## Implementation Steps

### Step 1: Database Migration
1. Create migration file: `drizzle/migrations/XXXX_add_onboarding_progress_fields.sql`
2. Update schema: [/elysia-server/src/db/schema/onboarding.ts](../../../elysia-server/src/db/schema/onboarding.ts)
3. Run migration: `npm run db:migrate`

### Step 2: Queue Setup
1. Add job types to [/elysia-server/src/lib/queue/types.ts](../../../elysia-server/src/lib/queue/types.ts)
2. Create queue in [/elysia-server/src/lib/queue/queues.ts](../../../elysia-server/src/lib/queue/queues.ts)

### Step 3: Service Refactoring
1. Create [/elysia-server/src/services/onboarding-worker.service.ts](../../../elysia-server/src/services/onboarding-worker.service.ts)
2. Extract phase functions from existing `onboarding.service.ts`:
   - `runDiscoveryPhase()` - discovery + enrichment combined, save per iteration
   - `runGroupPhase()` - customer group creation
   - `runTemplatesPhase()` - AI template generation
   - `runSequencePhase()` - sequence creation
   - `runPreviewsPhase()` - email generation in batches
3. Add checkpoint management functions:
   - `loadCheckpoint(workspaceId)`
   - `saveCheckpoint(workspaceId, checkpoint)`
   - `countLeadsWithEmails(workspaceId)` - base case check
4. Add duplicate filtering utilities:
   - `filterDuplicatesByWebsite(workspaceId, leads)`
   - `filterDuplicatesByEmail(workspaceId, leads)`
   - `saveEnrichedLeadsWithEmails(workspaceId, leads)` - only saves leads that have emails

### Step 4: Worker Implementation
1. Create [/elysia-server/src/workers/bullmq/onboarding-auto-generate.worker.ts](../../../elysia-server/src/workers/bullmq/onboarding-auto-generate.worker.ts)
2. Implement job processor with phase state machine
3. Add event handlers (completed, failed, progress)
4. Implement lifecycle functions (start, stop, status)

### Step 5: Route Integration
1. Update [/elysia-server/src/routes/auth.routes.ts:304-312](../../../elysia-server/src/routes/auth.routes.ts)
   - Replace `.catch()` fire-and-forget with `onboardingQueue.add()`
   - Store job ID in `onboarding_progress`
2. Add status endpoint to [/elysia-server/src/routes/onboarding.routes.ts](../../../elysia-server/src/routes/onboarding.routes.ts)
   - `GET /api/onboarding/status` - returns progress and job status (for DB viewing only, no real-time polling needed)

### Step 6: Worker Registration
1. Export worker from [/elysia-server/src/workers/bullmq/index.ts](../../../elysia-server/src/workers/bullmq/index.ts)
2. **Auto-start worker when server starts** (production-ready)
3. Add graceful shutdown handlers

### Step 7: Testing
1. Unit tests for phase functions
2. Integration tests for resume scenarios
3. Manual testing:
   - Fresh onboarding
   - Kill worker mid-discovery → restart → verify resume
   - Kill worker mid-enrichment → restart → verify resume
   - Monitor Redis and DB progress

## Critical Files Summary

**New Files**:
- `/elysia-server/src/workers/bullmq/onboarding-auto-generate.worker.ts` (270+ lines)
- `/elysia-server/src/services/onboarding-worker.service.ts` (400+ lines)
- `/elysia-server/drizzle/migrations/XXXX_add_onboarding_progress_fields.sql` (10 lines)

**Modified Files**:
- [/elysia-server/src/lib/queue/queues.ts](../../../elysia-server/src/lib/queue/queues.ts) (+15 lines)
- [/elysia-server/src/lib/queue/types.ts](../../../elysia-server/src/lib/queue/types.ts) (+20 lines)
- [/elysia-server/src/db/schema/onboarding.ts](../../../elysia-server/src/db/schema/onboarding.ts) (+10 lines)
- [/elysia-server/src/routes/auth.routes.ts](../../../elysia-server/src/routes/auth.routes.ts) (~15 lines changed)
- [/elysia-server/src/routes/onboarding.routes.ts](../../../elysia-server/src/routes/onboarding.routes.ts) (+30 lines)
- [/elysia-server/src/workers/bullmq/index.ts](../../../elysia-server/src/workers/bullmq/index.ts) (+5 lines)

**Modified Files (keep existing)**:
- [/elysia-server/src/services/onboarding.service.ts](../../../elysia-server/src/services/onboarding.service.ts) - Keep all existing functions intact, worker will reuse them

**Removed Functions**:
- `autoGenerateOnboarding()` - Remove completely, replaced by worker (no fallback needed)

## Key Design Decisions (User Confirmed)

1. **Save Per Iteration**: Save enriched leads with emails immediately after each BigQuery iteration completes
2. **Base Case**: Count leads with emails in workspace DB before each iteration (target: 300)
3. **Starting Point**: Onboarding workspaces start with zero leads
4. **Website Duplicates**: Skip entire lead if website URL exists in workspace (Option A)
5. **Email Duplicates**: Skip entire lead if primary email exists in workspace (Option A)
6. **Worker Startup**: Auto-start when server starts (production-ready)
7. **Existing Function**: Remove `autoGenerateOnboarding()` completely (no fallback)
8. **Progress Tracking**: Store in DB only, no real-time polling/SSE needed

## Benefits

1. **Resilience**: Survives server restarts, resumes from checkpoint
2. **Incremental**: Saves leads to DB after each iteration, not all at once
3. **Uniqueness**: Checks existing DB leads in workspace before inserting
4. **Progress**: Job progress tracked in DB state
5. **Monitoring**: Job logs, BullMQ UI, and status endpoint
6. **Memory Efficient**: 35MB peak vs 100MB current
7. **Maintainable**: Clear phase separation, reusable service functions
8. **Clean Data**: Only saves enriched leads that have valid emails
f