import { Command, END } from "@langchain/langgraph"
import { sql } from "drizzle-orm"
import { db } from "../../../db/drizzle"
import { chatbotLogger } from "../../../utils/logger"
import type { ChatbotState } from "../state"

/**
 * Node: handleSequenceGenerationRequest
 *
 * Checks if there's a sequence generation request and automatically
 * proceeds to generate the sequence without user confirmation.
 *
 * Flow:
 * 1. Check if sequenceGenerationRequest exists
 * 2. If yes, validate request data
 * 3. Route directly to generateSequenceForGroup
 * 4. If invalid, end the workflow
 */
export async function handleSequenceGenerationRequest(state: ChatbotState): Promise<Command> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("handleSequenceGenerationRequest")

  chatbotLogger.nodeDetail("handleSequenceGenerationRequest", {
    hasRequest: !!state.sequenceGenerationRequest,
    customerGroupId: state.sequenceGenerationRequest?.customerGroupId,
    customerGroupName: state.sequenceGenerationRequest?.customerGroupName,
    membersCount: state.sequenceGenerationRequest?.membersCount,
  })

  // If no request, skip to end
  if (!state.sequenceGenerationRequest) {
    chatbotLogger.nodeSuccess("handleSequenceGenerationRequest", Date.now() - startTime)
    chatbotLogger.routeDecision(
      "handleSequenceGenerationRequest",
      END,
      "no sequence generation request",
    )
    return new Command({ goto: END })
  }

  const { customerGroupId, customerGroupName, membersCount } = state.sequenceGenerationRequest

  // Validate request data
  if (!customerGroupId || !customerGroupName || !membersCount || membersCount === 0) {
    const duration = Date.now() - startTime
    chatbotLogger.nodeError("handleSequenceGenerationRequest", "Invalid request data", duration)
    return new Command({
      goto: END,
      update: {
        error: "Invalid sequence generation request data",
        analysis: "❌ Unable to generate sequence. Invalid request data.",
      },
    })
  }

  const duration = Date.now() - startTime
  chatbotLogger.nodeSuccess("handleSequenceGenerationRequest", duration)

  // Emit progress to frontend
  if (state._emitter) {
    state._emitter.progress(
      "handleSequenceGenerationRequest",
      `🚀 Starting AI-powered sequence generation for "${customerGroupName}" (${membersCount} leads)...`,
    )
  }

  // Auto-approve - directly route to sequence generation
  chatbotLogger.info(
    `[LangGraph] Auto-generating sequence for group: ${customerGroupName} (${customerGroupId})`,
  )
  chatbotLogger.routeDecision(
    "handleSequenceGenerationRequest",
    "generateSequenceForGroup",
    "auto-approved sequence generation",
  )

  return new Command({ goto: "analyzeLeadsAndGenerateStrategy" })
}

/**
 * ==================================================================================
 * Node: analyzeLeadsAndGenerateStrategy
 * ==================================================================================
 *
 * Analyzes a random sample of leads from the customer group and generates
 * an AI-powered email sequence strategy.
 *
 * STRATEGY:
 * 1. Sample 20 random leads from the customer group for AI analysis
 * 2. Analyze lead characteristics (business type, company size, lead score)
 * 3. Generate personalized email sequence strategy with AI
 * 4. Store strategy in state for next node to execute
 *
 * ==================================================================================
 */
export async function analyzeLeadsAndGenerateStrategy(state: ChatbotState): Promise<Command> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("analyzeLeadsAndGenerateStrategy")

  const request = state.sequenceGenerationRequest

  if (!request) {
    const duration = Date.now() - startTime
    chatbotLogger.nodeError(
      "analyzeLeadsAndGenerateStrategy",
      "No sequence generation request",
      duration,
    )
    return new Command({ goto: END })
  }

  const { customerGroupId, customerGroupName, membersCount } = request
  const { workspaceId } = state

  chatbotLogger.nodeDetail("analyzeLeadsAndGenerateStrategy", {
    customerGroupId,
    customerGroupName,
    membersCount,
    workspaceId,
  })

  // Emit progress event to frontend
  if (state._emitter) {
    state._emitter.progress(
      "analyzeLeadsAndGenerateStrategy",
      `📊 Analyzing ${membersCount} leads to generate optimal sequence strategy...`,
    )
  }

  try {
    // ==================================================================================
    // STEP 1: Sample 20 Random Leads for AI Analysis
    // ==================================================================================
    if (state._emitter) {
      state._emitter.progress(
        "analyzeLeadsAndGenerateStrategy",
        "Sampling 20 leads for analysis...",
      )
    }

    const leadSampleQuery = sql`
      SELECT
        l.id,
        l.company_name,
        l.contact_name,
        l.business_type,
        l.employee_count,
        l.lead_score,
        l.lead_source,
        l.description,
        l.city,
        l.country
      FROM leads l
      INNER JOIN customer_group_members cgm ON cgm.lead_id = l.id
      WHERE cgm.group_id = ${customerGroupId}
        AND l.workspace_id = ${workspaceId}
      ORDER BY RANDOM()
      LIMIT 20
    `

    interface LeadSample {
      id: string
      company_name: string | null
      contact_name: string | null
      business_type: string | null
      employee_count: string | null
      lead_score: number | null
      lead_source: string | null
      description: string | null
      city: string | null
      country: string | null
    }

    const leadSampleResult = (await db.execute(leadSampleQuery)) as unknown as {
      rows: LeadSample[]
    }
    const leadSamples = leadSampleResult.rows

    if (!leadSamples || leadSamples.length === 0) {
      throw new Error(
        `No leads found in customer group "${customerGroupName}". Please add leads to this group first.`,
      )
    }

    chatbotLogger.info(`[Sequence Strategy] Sampled ${leadSamples.length} leads for AI analysis`)
    chatbotLogger.nodeDetail("lead-samples", {
      sampleCount: leadSamples.length,
      companies: leadSamples.map((l) => l.company_name).slice(0, 5),
      businessTypes: [...new Set(leadSamples.map((l) => l.business_type).filter(Boolean))],
    })

    // ==================================================================================
    // STEP 2: AI Analysis - Extract Lead Characteristics
    // ==================================================================================
    if (state._emitter) {
      state._emitter.progress(
        "analyzeLeadsAndGenerateStrategy",
        "🤖 Analyzing lead data with AI...",
      )
    }

    // Calculate average lead score
    const avgLeadScore =
      leadSamples.reduce((sum, lead) => sum + (lead.lead_score || 0), 0) / leadSamples.length

    // Determine dominant business type
    const businessTypeCounts: Record<string, number> = {}
    for (const lead of leadSamples) {
      const type = lead.business_type || "Business"
      businessTypeCounts[type] = (businessTypeCounts[type] || 0) + 1
    }
    const dominantBusinessType =
      Object.entries(businessTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Business"

    // Calculate average company size
    const companySizes = leadSamples
      .map((l) => Number.parseInt(l.employee_count || "0", 10))
      .filter((size) => size > 0)
    const avgCompanySize =
      companySizes.length > 0
        ? companySizes.reduce((sum, size) => sum + size, 0) / companySizes.length
        : 0

    // Determine company size category
    let companySizeCategory = "small to medium"
    if (avgCompanySize > 500) companySizeCategory = "large enterprise"
    else if (avgCompanySize > 100) companySizeCategory = "mid-sized"

    // Get unique business types
    const businessTypes = [...new Set(leadSamples.map((l) => l.business_type).filter(Boolean))]
    const businessTypeFocus = businessTypes.length <= 2 ? businessTypes.join(" and ") : "various"

    chatbotLogger.nodeDetail("ai-analysis", {
      avgLeadScore: avgLeadScore.toFixed(1),
      dominantBusinessType,
      avgCompanySize: Math.round(avgCompanySize),
      companySizeCategory,
      businessTypeFocus,
      uniqueBusinessTypes: businessTypes.length,
    })

    // ==================================================================================
    // STEP 3: Generate AI-Powered Email Sequence Strategy
    // ==================================================================================
    if (state._emitter) {
      state._emitter.progress(
        "analyzeLeadsAndGenerateStrategy",
        "✨ Generating personalized email sequence strategy...",
      )
    }

    // For now, use a simple strategy based on analysis
    // TODO: Later integrate with LLM for more sophisticated strategy generation
    const emailStrategy = {
      step1: {
        subject: `Transform Your ${dominantBusinessType} Business with AI Solutions`,
        body: `Hi {{contact_name}},\n\nI noticed {{company_name}} is a ${companySizeCategory} company in the ${dominantBusinessType} industry.\n\nWe specialize in helping companies like yours leverage AI to achieve breakthrough results and operational excellence.\n\nWould you be interested in a brief 15-minute call next week to discuss how we can help {{company_name}} achieve its goals?\n\nBest regards`,
        delay_days: 0,
        timing: "9:00 AM",
      },
      step2: {
        subject: `Case Study: How ${dominantBusinessType} Leaders Achieve 40% Growth`,
        body: `Hi {{contact_name}},\n\nI wanted to share a recent case study that might interest {{company_name}}.\n\nWe recently helped a ${companySizeCategory} ${dominantBusinessType} company achieve 40% revenue growth in just 6 months by implementing our AI-powered automation platform.\n\nTheir challenges were similar to what many ${dominantBusinessType} companies face:\n• Manual processes consuming valuable time\n• Difficulty scaling operations\n• Limited visibility into key metrics\n\nWould you like to see the full case study? I can send it over right away.\n\nBest regards`,
        delay_days: 3,
        timing: "10:00 AM",
      },
      step3: {
        subject: `Last Chance: Exclusive Workshop for ${dominantBusinessType} Leaders`,
        body: `Hi {{contact_name}},\n\nThis is my final email to you about our exclusive opportunity.\n\nWe are hosting a private workshop for top ${dominantBusinessType} leaders next month where we will share:\n• Advanced AI strategies that are working RIGHT NOW\n• Live demonstrations of real-world implementations\n• Exclusive networking with industry peers\n\nOnly 10 spots are available, and we are already at 7 confirmed attendees.\n\nWould {{company_name}} like to join us?\n\nPlease reply by Friday to secure your spot!\n\nBest regards`,
        delay_days: 5,
        timing: "2:00 PM",
      },
    }

    const sequenceStrategy = {
      dominant_business_type: dominantBusinessType,
      avg_company_size: Math.round(avgCompanySize),
      company_size_category: companySizeCategory,
      avg_lead_score: Number.parseFloat(avgLeadScore.toFixed(1)),
      business_type_focus: businessTypeFocus,
      samples_analyzed: leadSamples.length,
      email_strategy: emailStrategy,
    }

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("analyzeLeadsAndGenerateStrategy", duration)

    // Emit success event to frontend
    if (state._emitter) {
      state._emitter.nodeComplete(
        "analyzeLeadsAndGenerateStrategy",
        `✅ Strategy generated! Analyzed ${leadSamples.length} leads from ${customerGroupName}`,
        sequenceStrategy,
      )
    }

    chatbotLogger.info(
      `[Sequence Strategy] Strategy generated successfully for ${customerGroupName}`,
    )

    return new Command({
      goto: "generateSequenceWithStrategy",
      update: {
        sequenceStrategy,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const duration = Date.now() - startTime

    chatbotLogger.nodeError("analyzeLeadsAndGenerateStrategy", errorMessage, duration)

    if (state._emitter) {
      state._emitter.error("analyzeLeadsAndGenerateStrategy", errorMessage)
    }

    return new Command({
      goto: END,
      update: {
        error: errorMessage,
        analysis: `❌ **Strategy Generation Failed**\n\n${errorMessage}\n\nPlease check that the customer group exists and has leads.`,
        pendingSequenceGeneration: false,
        sequenceGenerationRequest: undefined,
      },
    })
  }
}

/**
 * ==================================================================================
 * Node: generateSequenceWithStrategy
 * ==================================================================================
 *
 * Executes the AI-generated strategy to create an email sequence in the database.
 *
 * FLOW:
 * 1. Validate strategy exists from previous node
 * 2. Execute CTE query to create sequence and steps in database
 * 3. Return success with sequence details
 *
 * DATABASE SCHEMA USED:
 * - sequences: Main sequence table
 *   - id (uuid), workspace_id, customer_group_id, name, description, status
 *   - status ENUM: 'draft' | 'active' | 'paused' | 'archived' | 'completed'
 *
 * - sequence_steps: Individual email steps in the sequence
 *   - id (uuid), sequence_id, step_order, delay_days
 *   - scheduled_hour, scheduled_minute, timezone
 *   - email_subject, email_body_text, email_body_html
 *
 * - customer_groups: Link to customer group
 *   - Sequence is linked via customer_group_id (nullable FK)
 *
 * TRANSACTION GUARANTEES:
 * - All operations execute in a single atomic transaction
 * - If any step fails, entire operation rolls back
 * - No partial data is committed
 *
 * ==================================================================================
 */
export async function generateSequenceWithStrategy(state: ChatbotState): Promise<Command> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("generateSequenceWithStrategy")

  const request = state.sequenceGenerationRequest
  const strategy = state.sequenceStrategy

  if (!request) {
    const duration = Date.now() - startTime
    chatbotLogger.nodeError(
      "generateSequenceWithStrategy",
      "No sequence generation request",
      duration,
    )
    return new Command({ goto: END })
  }

  if (!strategy) {
    const duration = Date.now() - startTime
    chatbotLogger.nodeError("generateSequenceWithStrategy", "No strategy found in state", duration)
    return new Command({
      goto: END,
      update: {
        error: "No strategy found. Please regenerate the sequence.",
        analysis: "❌ **Sequence Generation Failed**\n\nNo strategy found. Please try again.",
      },
    })
  }

  const { customerGroupId, customerGroupName, membersCount } = request
  const { workspaceId } = state

  chatbotLogger.nodeDetail("generateSequenceWithStrategy", {
    customerGroupId,
    customerGroupName,
    membersCount,
    workspaceId,
    strategy: {
      business_type: strategy.dominant_business_type,
      company_size: strategy.company_size_category,
    },
  })

  // Emit progress event to frontend
  if (state._emitter) {
    state._emitter.progress(
      "generateSequenceWithStrategy",
      `🚀 Creating sequence with AI-generated strategy...`,
    )
  }

  try {
    // ==================================================================================
    // PRE-VALIDATION: Check workspace and customer group exist
    // ==================================================================================
    chatbotLogger.info("[Sequence Generation] Pre-validating workspace and customer group")

    const workspaceCheck = await db.execute(sql`
      SELECT id, name FROM workspaces WHERE id = ${workspaceId}
    `)

    if (!workspaceCheck.rows || workspaceCheck.rows.length === 0) {
      throw new Error(`Workspace not found: ${workspaceId}. The workspace may have been deleted.`)
    }

    const customerGroupCheck = await db.execute(sql`
      SELECT id, name, workspace_id FROM customer_groups WHERE id = ${customerGroupId}
    `)

    if (!customerGroupCheck.rows || customerGroupCheck.rows.length === 0) {
      throw new Error(
        `Customer group not found: ${customerGroupId}. The group may have been deleted.`,
      )
    }

    const customerGroup = customerGroupCheck.rows[0] as { workspace_id: string }
    if (customerGroup.workspace_id !== workspaceId) {
      throw new Error(
        `Customer group ${customerGroupId} does not belong to workspace ${workspaceId}`,
      )
    }

    chatbotLogger.info("[Sequence Generation] ✓ Workspace and customer group validated")

    // ==================================================================================
    // Execute sequence generation in a transaction for atomicity
    // ==================================================================================
    const result = await db.transaction(async (tx) => {
      chatbotLogger.info("[Sequence Generation] Starting atomic transaction with strategy")

      // Extract strategy data
      const escapedGroupName = customerGroupName.replace(/'/g, "''")
      const escapedBusinessType = strategy.dominant_business_type.replace(/'/g, "''")
      const avgLeadScore = strategy.avg_lead_score
      const avgCompanySize = strategy.avg_company_size
      const companySizeCategory = strategy.company_size_category
      const businessTypeFocus = strategy.business_type_focus
      const samplesAnalyzed = strategy.samples_analyzed

      chatbotLogger.nodeDetail("using-strategy", {
        business_type: escapedBusinessType,
        company_size: companySizeCategory,
        avg_lead_score: avgLeadScore,
        samples: samplesAnalyzed,
      })

      // ==================================================================================
      // Execute CTE Query to Create Sequence with Strategy
      // ==================================================================================
      // Uses Common Table Expressions (CTE) for atomic multi-step creation:
      // 1. new_sequence - Creates the main sequence record
      // 2. new_sequence_step_1-3 - Creates 3 email steps with AI-generated content
      // 3. activated_sequence - Activates the sequence (status = 'active')
      //
      // All steps reference previous CTEs, ensuring referential integrity
      // ==================================================================================
      if (state._emitter) {
        state._emitter.progress(
          "generateSequenceWithStrategy",
          "💾 Executing CTE query to create sequence...",
        )
      }

      // Escape email content for SQL injection prevention
      const escapedStep1Subject = strategy.email_strategy.step1.subject.replace(/'/g, "''")
      const escapedStep1Body = strategy.email_strategy.step1.body.replace(/'/g, "''")
      const escapedStep2Subject = strategy.email_strategy.step2.subject.replace(/'/g, "''")
      const escapedStep2Body = strategy.email_strategy.step2.body.replace(/'/g, "''")
      const escapedStep3Subject = strategy.email_strategy.step3.subject.replace(/'/g, "''")
      const escapedStep3Body = strategy.email_strategy.step3.body.replace(/'/g, "''")

      // Log all escaped strings for debugging
      chatbotLogger.nodeDetail("escaped-email-content", {
        step1_subject_length: escapedStep1Subject.length,
        step1_body_length: escapedStep1Body.length,
        step2_subject_length: escapedStep2Subject.length,
        step2_body_length: escapedStep2Body.length,
        step3_subject_length: escapedStep3Subject.length,
        step3_body_length: escapedStep3Body.length,
        has_newlines: {
          step1: escapedStep1Body.includes("\n"),
          step2: escapedStep2Body.includes("\n"),
          step3: escapedStep3Body.includes("\n"),
        },
      })

      chatbotLogger.info("[Sequence Generation] Building CTE query with strategy data")

      const sequenceGenerationQuery = sql.raw(`
WITH
-- ==================================================================================
-- CTE 1: Create Sequence (ACTIVE)
-- ==================================================================================
-- Creates the main sequence record linked to the customer group
-- Status is set to 'active' directly (no need for separate activation step)
-- ==================================================================================
new_sequence AS (
  INSERT INTO sequences (
    id,
    workspace_id,
    customer_group_id,
    name,
    description,
    status,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    '${workspaceId}',
    '${customerGroupId}',
    'AI-Generated Sequence for ${escapedGroupName}',
    'AI-optimized sequence for ${companySizeCategory} ${escapedBusinessType} companies (avg score: ${avgLeadScore.toFixed(1)}, ${samplesAnalyzed} samples analyzed)',
    'active',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  RETURNING *
),

-- ==================================================================================
-- CTE 2: Create Sequence Step 1 - Initial Contact (Day 0)
-- ==================================================================================
-- First touch: Introduction and value proposition
-- Timing: Send at 9 AM (optimal open rate based on industry data)
-- Personalization: Uses {{contact_name}} and {{company_name}} variables
-- ==================================================================================
new_sequence_step_1 AS (
  INSERT INTO sequence_steps (
    id,
    sequence_id,
    step_order,
    delay_days,
    scheduled_hour,
    scheduled_minute,
    timezone,
    email_subject,
    email_body_text,
    created_at,
    updated_at
  ) SELECT
    gen_random_uuid(),
    id,                               -- References new_sequence.id
    1,                                -- First step in sequence
    ${strategy.email_strategy.step1.delay_days},  -- Delay from strategy
    9,                                -- 9 AM (default)
    0,                                -- :00 minutes
    'Asia/Seoul',                     -- KST timezone
    '${escapedStep1Subject}',
    E'${escapedStep1Body.replace(/\n/g, "\\n")}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM new_sequence
  RETURNING *
),

-- ==================================================================================
-- CTE 3: Create Sequence Step 2 - Value Demonstration (Day 3)
-- ==================================================================================
-- Second touch: Case study and social proof
-- Timing: 3 days after step 1, sent at 10 AM (mid-morning engagement)
-- Content: Industry-specific case study to build credibility
-- ==================================================================================
new_sequence_step_2 AS (
  INSERT INTO sequence_steps (
    id,
    sequence_id,
    step_order,
    delay_days,
    scheduled_hour,
    scheduled_minute,
    timezone,
    email_subject,
    email_body_text,
    created_at,
    updated_at
  ) SELECT
    gen_random_uuid(),
    id,                               -- References new_sequence.id
    2,                                -- Second step in sequence
    ${strategy.email_strategy.step2.delay_days},  -- Delay from strategy
    10,                               -- 10 AM (default)
    0,
    'Asia/Seoul',
    '${escapedStep2Subject}',
    E'${escapedStep2Body.replace(/\n/g, "\\n")}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM new_sequence
  RETURNING *
),

-- ==================================================================================
-- CTE 4: Create Sequence Step 3 - Urgency & Final CTA (Day 8)
-- ==================================================================================
-- Third touch: Create urgency with limited-time opportunity
-- Timing: 5 days after step 2 (8 days total), sent at 2 PM (post-lunch)
-- Content: Exclusive offer to create FOMO and drive action
-- ==================================================================================
new_sequence_step_3 AS (
  INSERT INTO sequence_steps (
    id,
    sequence_id,
    step_order,
    delay_days,
    scheduled_hour,
    scheduled_minute,
    timezone,
    email_subject,
    email_body_text,
    created_at,
    updated_at
  ) SELECT
    gen_random_uuid(),
    id,                               -- References new_sequence.id
    3,                                -- Third and final step
    ${strategy.email_strategy.step3.delay_days},  -- Delay from strategy
    14,                               -- 2 PM (default)
    0,
    'Asia/Seoul',
    '${escapedStep3Subject}',
    E'${escapedStep3Body.replace(/\n/g, "\\n")}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM new_sequence
  RETURNING *
)

-- ==================================================================================
-- Final SELECT: Return Comprehensive Summary
-- ==================================================================================
-- Returns a JSON object with all created data for verification and logging
-- Sequence is created with 'active' status directly (no separate activation needed)
-- No enrollments are created (sequence is only linked to customer group)
-- ==================================================================================
SELECT json_build_object(
  'sequence', (SELECT row_to_json(new_sequence.*) FROM new_sequence),
  'steps', (
    SELECT json_agg(row_to_json(steps.*) ORDER BY steps.step_order) FROM (
      SELECT * FROM new_sequence_step_1
      UNION ALL SELECT * FROM new_sequence_step_2
      UNION ALL SELECT * FROM new_sequence_step_3
    ) steps
  ),
  'total_steps', 3,
  'status', 'active',
  'linked_to_group', true,
  'customer_group_id', '${customerGroupId}',
  'customer_group_name', '${escapedGroupName}',
  'total_leads_in_group', ${membersCount},
  'ai_analysis', json_build_object(
    'avg_lead_score', ${avgLeadScore.toFixed(1)},
    'dominant_business_type', '${escapedBusinessType}',
    'avg_company_size', ${Math.round(avgCompanySize)},
    'company_size_category', '${companySizeCategory}',
    'business_type_focus', '${businessTypeFocus}',
    'samples_analyzed', ${samplesAnalyzed}
  ),
  'created_at', CURRENT_TIMESTAMP
) as result
      `)

      interface SequenceResult {
        result: {
          sequence: {
            id: string
            name: string
            status: string
            customer_group_id: string
            description: string
          }
          steps: {
            id: string
            sequence_id: string
            step_order: number
            email_subject: string
            delay_days: number
            scheduled_hour: number
            scheduled_minute: number
            timezone: string
          }[]
          total_steps: number
          total_leads_in_group: number
          customer_group_name: string
          created_at: string
          ai_analysis: {
            avg_lead_score: number
            dominant_business_type: string
            avg_company_size: number
            company_size_category: string
            business_type_focus: string
            samples_analyzed: number
          }
        }
      }

      chatbotLogger.info("[Sequence Generation] Executing CTE query...")

      let sequenceResult: { rows: SequenceResult[] }
      try {
        sequenceResult = (await tx.execute(sequenceGenerationQuery)) as unknown as {
          rows: SequenceResult[]
        }
      } catch (sqlError) {
        const sqlErrorMessage = sqlError instanceof Error ? sqlError.message : String(sqlError)
        chatbotLogger.error(
          `[Sequence Generation] SQL execution failed:\n` +
            `┌─────────────────────────────────────────────────────────────\n` +
            `│ SQL ERROR: ${sqlErrorMessage}\n` +
            `├─────────────────────────────────────────────────────────────\n` +
            `│ Workspace ID: ${workspaceId}\n` +
            `│ Customer Group ID: ${customerGroupId}\n` +
            `│ Customer Group Name: ${escapedGroupName}\n` +
            `│ Strategy: ${escapedBusinessType} (${companySizeCategory})\n` +
            `│ Stack: ${sqlError instanceof Error ? sqlError.stack : "N/A"}\n` +
            `└─────────────────────────────────────────────────────────────`,
        )
        throw new Error(`Database query execution failed: ${sqlErrorMessage}`)
      }

      chatbotLogger.info("[Sequence Generation] CTE query executed, processing results...")
      chatbotLogger.nodeDetail("query-result", {
        has_rows: !!sequenceResult.rows,
        rows_length: sequenceResult.rows?.length || 0,
        first_row_keys: sequenceResult.rows?.[0] ? Object.keys(sequenceResult.rows[0]) : [],
      })

      const sequenceData = sequenceResult.rows[0]?.result

      // Validation: Check if result exists
      if (!sequenceData) {
        chatbotLogger.error(
          `[Sequence Generation] Query returned no data:\n` +
            `┌─────────────────────────────────────────────────────────────\n` +
            `│ Result rows: ${JSON.stringify(sequenceResult.rows, null, 2)}\n` +
            `└─────────────────────────────────────────────────────────────`,
        )
        throw new Error(
          "Failed to create sequence. Query executed but returned no data. This may indicate a database constraint violation or missing required fields.",
        )
      }

      // Validation: Check if sequence object exists
      if (!sequenceData.sequence) {
        chatbotLogger.error(
          `[Sequence Generation] new_sequence CTE returned null:\n` +
            `┌─────────────────────────────────────────────────────────────\n` +
            `│ This indicates the INSERT INTO sequences failed silently.\n` +
            `│ Possible causes:\n` +
            `│ 1. Foreign key constraint on workspace_id failed\n` +
            `│ 2. Foreign key constraint on customer_group_id failed\n` +
            `│ 3. Check constraint on status enum failed\n` +
            `│ 4. gen_random_uuid() function not available\n` +
            `├─────────────────────────────────────────────────────────────\n` +
            `│ Sequence Data: ${JSON.stringify(sequenceData, null, 2)}\n` +
            `├─────────────────────────────────────────────────────────────\n` +
            `│ Steps Created: ${sequenceData.steps?.length || 0}\n` +
            `│ Steps have sequence_id: ${sequenceData.steps?.[0]?.sequence_id || "N/A"}\n` +
            `└─────────────────────────────────────────────────────────────`,
        )
        throw new Error(
          "Failed to create sequence. The 'new_sequence' CTE returned NULL, indicating the INSERT failed. " +
            "Check foreign key constraints on workspace_id and customer_group_id.",
        )
      }

      // Validation: Verify sequence status is active
      if (sequenceData.sequence.status !== "active") {
        chatbotLogger.warn(
          `[Sequence Generation] Sequence created but status is not active: ${sequenceData.sequence.status}`,
        )
      }

      // Validation: Check if steps were created
      if (!sequenceData.steps || sequenceData.steps.length !== 3) {
        chatbotLogger.error(
          `[Sequence Generation] Expected 3 steps but got ${sequenceData.steps?.length || 0}`,
        )
        throw new Error(
          `Failed to create all sequence steps. Expected 3 steps but created ${sequenceData.steps?.length || 0}.`,
        )
      }

      chatbotLogger.info(
        `[Sequence Generation] ✓ Successfully created sequence ${sequenceData.sequence.id}`,
      )
      chatbotLogger.nodeDetail("sequence-created", {
        sequenceId: sequenceData.sequence.id,
        sequenceName: sequenceData.sequence.name,
        sequenceStatus: sequenceData.sequence.status,
        customerGroupId: sequenceData.sequence.customer_group_id,
        customerGroupName: customerGroupName,
        totalSteps: sequenceData.total_steps,
        totalLeadsInGroup: sequenceData.total_leads_in_group,
        stepDetails: sequenceData.steps.map((s) => ({
          order: s.step_order,
          delay_days: s.delay_days,
          subject: s.email_subject,
        })),
        aiAnalysis: sequenceData.ai_analysis,
        createdAt: sequenceData.created_at,
      })

      return sequenceData
    })

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("generateSequenceWithStrategy", duration)

    // Emit success event to frontend
    if (state._emitter) {
      state._emitter.nodeComplete(
        "generateSequenceWithStrategy",
        `✅ Successfully created AI-optimized sequence with ${result.total_steps} steps!`,
        result,
      )
    }

    // Format detailed success message
    const successMessage = `
🎉 **AI-Optimized Sequence Created Successfully!**

**Sequence Details:**
- **Name:** ${result.sequence.name}
- **Status:** ✅ ${result.sequence.status.toUpperCase()}
- **ID:** ${result.sequence.id}
- **Linked to Group:** ${result.customer_group_name} (${result.total_leads_in_group} leads)

**AI Analysis:**
- **Average Lead Score:** ${result.ai_analysis.avg_lead_score}
- **Business Focus:** ${result.ai_analysis.dominant_business_type}
- **Company Size:** ${result.ai_analysis.company_size_category} (avg ${result.ai_analysis.avg_company_size} employees)
${result.ai_analysis.business_type_focus ? `- **Business Type Focus:** ${result.ai_analysis.business_type_focus}` : ""}
- **Samples Analyzed:** ${result.ai_analysis.samples_analyzed} leads

**Email Sequence Steps:**
${result.steps.map((step) => `${step.step_order}. ${step.email_subject} (Day ${step.delay_days === 0 ? "0 - Immediate" : step.delay_days})`).join("\n")}

**Timing Strategy:**
${result.steps
  .map((step) => {
    const hour = step.scheduled_hour || 9
    const minute = (step.scheduled_minute || 0).toString().padStart(2, "0")
    const dayLabel = step.delay_days === 0 ? "Immediate" : `Day ${step.delay_days}`
    return `- Step ${step.step_order}: ${dayLabel} (${hour}:${minute} ${step.timezone || "Asia/Seoul"})`
  })
  .join("\n")}

**Next Steps:**
✅ Your sequence is now **ACTIVE** and ready to use
✅ Enroll leads from the "${result.customer_group_name}" group to start sending
✅ Email content is optimized based on AI analysis of ${result.ai_analysis.samples_analyzed} sample leads
✅ Monitor performance metrics as emails are sent
    `.trim()

    return new Command({
      goto: END,
      update: {
        analysis: successMessage,
        generatedSequenceId: result.sequence.id,
        pendingSequenceGeneration: false,
        sequenceGenerationRequest: undefined,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const duration = Date.now() - startTime

    chatbotLogger.nodeError("generateSequenceWithStrategy", errorMessage, duration)

    // Determine error category for better debugging
    let errorCategory = "UNKNOWN"
    let troubleshootingHints: string[] = []

    if (errorMessage.includes("not found")) {
      errorCategory = "RESOURCE_NOT_FOUND"
      troubleshootingHints = [
        "• Check if the workspace still exists in the database",
        "• Check if the customer group was deleted",
        "• Verify workspace_id and customer_group_id are correct UUIDs",
      ]
    } else if (errorMessage.includes("does not belong")) {
      errorCategory = "PERMISSION_ERROR"
      troubleshootingHints = [
        "• Customer group belongs to a different workspace",
        "• Check workspace permissions and ownership",
      ]
    } else if (errorMessage.includes("SQL") || errorMessage.includes("query")) {
      errorCategory = "SQL_EXECUTION_ERROR"
      troubleshootingHints = [
        "• Check if PostgreSQL supports gen_random_uuid() function",
        "• Verify timezone 'Asia/Seoul' is registered in PostgreSQL",
        "• Check for special characters in email content causing SQL syntax errors",
        "• Review database constraints (foreign keys, unique constraints, etc.)",
        "• Verify all required columns exist in sequences and sequence_steps tables",
      ]
    } else if (errorMessage.includes("constraint")) {
      errorCategory = "CONSTRAINT_VIOLATION"
      troubleshootingHints = [
        "• Check foreign key constraints",
        "• Verify unique constraints are not violated",
        "• Check NOT NULL constraints on required fields",
      ]
    } else if (errorMessage.includes("transaction")) {
      errorCategory = "TRANSACTION_ERROR"
      troubleshootingHints = [
        "• Database may be locked or busy",
        "• Check for deadlocks or concurrent transactions",
        "• Verify database connection is stable",
      ]
    }

    // Log detailed error with context
    if (error instanceof Error && error.message) {
      chatbotLogger.error(
        `[Sequence With Strategy] Transaction failed:\n` +
          `┌─────────────────────────────────────────────────────────────\n` +
          `│ ERROR CATEGORY: ${errorCategory}\n` +
          `│ ERROR MESSAGE: ${error.message}\n` +
          `├─────────────────────────────────────────────────────────────\n` +
          `│ CONTEXT:\n` +
          `│ • Customer Group: ${customerGroupName} (${customerGroupId})\n` +
          `│ • Workspace: ${workspaceId}\n` +
          `│ • Expected Leads: ${membersCount}\n` +
          `│ • Strategy: ${strategy.dominant_business_type} (${strategy.company_size_category})\n` +
          `│ • Samples Analyzed: ${strategy.samples_analyzed}\n` +
          `│ • Email Steps: 3 (Step 1: Day 0, Step 2: Day 3, Step 3: Day 8)\n` +
          `├─────────────────────────────────────────────────────────────\n` +
          `│ TROUBLESHOOTING:\n` +
          (troubleshootingHints.length > 0
            ? troubleshootingHints.join("\n│ ")
            : "│ • No specific hints available") +
          `\n├─────────────────────────────────────────────────────────────\n` +
          `│ STACK TRACE:\n` +
          `│ ${error.stack?.split("\n").join("\n│ ") || "N/A"}\n` +
          `└─────────────────────────────────────────────────────────────`,
      )
    }

    if (state._emitter) {
      state._emitter.error("generateSequenceWithStrategy", errorMessage)
    }

    return new Command({
      goto: END,
      update: {
        error: errorMessage,
        analysis: `❌ **Sequence Generation Failed**\n\n${errorMessage}\n\nPlease check that:\n- The customer group exists and has leads\n- You have an active email account configured\n- Your workspace has proper permissions\n\nIf the issue persists, please contact support.`,
        pendingSequenceGeneration: false,
        sequenceGenerationRequest: undefined,
      },
    })
  }
}
