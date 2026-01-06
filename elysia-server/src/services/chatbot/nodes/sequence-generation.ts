import { Command, END } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"
import { sql } from "drizzle-orm"
import { db } from "../../../db/drizzle"
import { chatbotLogger } from "../../../utils/logger"
import { getAITemplateGenerationService } from "../../ai-template-generation.service"
import { getAISequenceStrategyOnlyPrompt } from "../prompts"
import type { ChatbotState } from "../state"

// LLM for AI-powered sequence strategy generation
// Note: gpt-5 models do not support temperature, uses reasoning_effort instead
const strategyLLM = new ChatOpenAI({
  model: "gpt-5-mini",
  reasoning: { effort: "low" },
})

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
      `Starting AI-powered sequence generation for "${customerGroupName}" (${membersCount} leads)...`,
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
      `Analyzing ${membersCount} leads to generate optimal sequence strategy...`,
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
      state._emitter.progress("analyzeLeadsAndGenerateStrategy", "Analyzing lead data with AI...")
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
    // STEP 3: Get Workspace Info for AI Template Generation
    // ==================================================================================
    const workspaceQuery = sql`
      SELECT id, name, description, company_name, company_name_en 
      FROM workspaces 
      WHERE id = ${workspaceId}
    `
    const workspaceResult = await db.execute(workspaceQuery)
    const workspace = workspaceResult.rows[0] as {
      id: string
      name: string
      description: string | null
      companyName: string | null
      companyNameEn: string | null
    }

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }

    chatbotLogger.info(`[Sequence Strategy] Found workspace: ${workspace.name}`)

    // Determine dominant country from samples
    const countryCounts: Record<string, number> = {}
    for (const sample of leadSamples) {
      const country = sample.country || "Unknown"
      countryCounts[country] = (countryCounts[country] || 0) + 1
    }
    const dominantCountry =
      Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Korea"

    chatbotLogger.info(`[Sequence Strategy] Dominant country: ${dominantCountry}`)

    // ==================================================================================
    // STEP 4: Generate AI-Powered Sequence Strategy (Without Email Content)
    // ==================================================================================
    if (state._emitter) {
      state._emitter.progress(
        "analyzeLeadsAndGenerateStrategy",
        "AI가 시퀀스 전략을 생성하고 있습니다...",
      )
    }

    chatbotLogger.info("[Sequence Strategy] Invoking LLM for strategy-only generation")

    // Prepare lead analysis data for AI prompt
    const leadAnalysisData = {
      samples: leadSamples,
      avgLeadScore,
      dominantBusinessType,
      avgCompanySize,
      companySizeCategory,
      businessTypeFocus,
      customerGroupName,
      totalMembers: membersCount,
    }

    const strategyPrompt = getAISequenceStrategyOnlyPrompt(leadAnalysisData)

    let aiStrategyResponse: string
    try {
      const response = await strategyLLM.invoke(strategyPrompt)
      aiStrategyResponse = response.content as string
      chatbotLogger.info("[Sequence Strategy] LLM strategy response received")
    } catch (llmError) {
      const llmErrorMessage = llmError instanceof Error ? llmError.message : String(llmError)
      chatbotLogger.error(`[Sequence Strategy] LLM invocation failed: ${llmErrorMessage}`)
      throw new Error(`AI strategy generation failed: ${llmErrorMessage}`)
    }

    // Parse AI response (handle markdown code blocks)
    const jsonMatch =
      aiStrategyResponse.match(/```json\n?([\s\S]*?)\n?```/) ||
      aiStrategyResponse.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch?.[1] || aiStrategyResponse

    interface AIStrategyOnlyResponse {
      strategy_summary: string
      recommended_steps: number
      timezone: string
      dominant_country: string
      steps: Array<{
        step_order: number
        delay_days: number
        scheduled_hour: number
        scheduled_minute: number
        purpose: string
        tone: string
        key_points: string[]
      }>
      personalization_tips: string[]
      expected_performance: {
        estimated_open_rate: string
        estimated_response_rate: string
        reasoning: string
      }
    }

    let aiStrategy: AIStrategyOnlyResponse
    try {
      aiStrategy = JSON.parse(jsonStr.trim())
      chatbotLogger.info(
        `[Sequence Strategy] AI generated ${aiStrategy.recommended_steps} steps strategy`,
      )
      chatbotLogger.nodeDetail("ai-strategy", {
        steps_count: aiStrategy.steps.length,
        strategy_summary: aiStrategy.strategy_summary,
        timezone: aiStrategy.timezone,
        expected_open_rate: aiStrategy.expected_performance.estimated_open_rate,
      })
    } catch (_parseError) {
      chatbotLogger.error(`[Sequence Strategy] Failed to parse AI response:\n${aiStrategyResponse}`)
      throw new Error("Failed to parse AI-generated strategy. Invalid JSON format.")
    }

    // Validate AI strategy
    if (!aiStrategy.steps || aiStrategy.steps.length < 2 || aiStrategy.steps.length > 5) {
      throw new Error(
        `Invalid number of steps generated: ${aiStrategy.steps?.length || 0}. Expected 2-5 steps.`,
      )
    }

    // ==================================================================================
    // STEP 5: Generate Email Content for Each Step Using AITemplateGenerationService
    // ==================================================================================
    if (state._emitter) {
      state._emitter.progress(
        "analyzeLeadsAndGenerateStrategy",
        `AI가 ${aiStrategy.steps.length}개의 이메일을 생성하고 있습니다...`,
      )
    }

    chatbotLogger.info(
      `[Sequence Strategy] Generating email content for ${aiStrategy.steps.length} steps`,
    )

    const aiService = getAITemplateGenerationService()
    const emailSteps: Array<{
      step_order: number
      delay_days: number
      scheduled_hour: number
      scheduled_minute: number
      email_subject: string
      email_body: string
      strategy_note: string
    }> = []

    for (const step of aiStrategy.steps) {
      if (state._emitter) {
        state._emitter.progress(
          "analyzeLeadsAndGenerateStrategy",
          `스텝 ${step.step_order}/${aiStrategy.steps.length} 이메일 생성 중...`,
        )
      }

      // Build prompt for this step based on strategy
      const stepPrompt = buildStepEmailPrompt(step, leadAnalysisData, aiStrategy.strategy_summary)

      try {
        const template = await aiService.generateEmailTemplate({
          workspaceName: workspace.companyName || workspace.name,
          workspaceNameEn: workspace.companyNameEn || undefined,
          workspaceDescription: workspace.description || undefined,
          country: aiStrategy.dominant_country || dominantCountry,
          userPrompt: stepPrompt,
          temperature: 0.7,
        })

        emailSteps.push({
          step_order: step.step_order,
          delay_days: step.delay_days,
          scheduled_hour: step.scheduled_hour,
          scheduled_minute: step.scheduled_minute,
          email_subject: template.subject,
          email_body: template.bodyText,
          strategy_note: step.purpose,
        })

        chatbotLogger.info(
          `[Sequence Strategy] Generated email for step ${step.step_order}: "${template.subject}"`,
        )
      } catch (emailError) {
        const emailErrorMessage =
          emailError instanceof Error ? emailError.message : String(emailError)
        chatbotLogger.error(
          `[Sequence Strategy] Failed to generate email for step ${step.step_order}: ${emailErrorMessage}`,
        )
        throw new Error(
          `Failed to generate email for step ${step.step_order}: ${emailErrorMessage}`,
        )
      }
    }

    // ==================================================================================
    // CRITICAL: Override Step 1 timing to be 2 minutes from now (KST)
    // ==================================================================================
    // Calculate current KST time + 2 minutes
    const now = new Date()
    const kstOffset = 9 * 60 * 60 * 1000 // KST is UTC+9
    const kstNow = new Date(now.getTime() + kstOffset)
    const kstPlus2Min = new Date(kstNow.getTime() + 2 * 60 * 1000) // Add 2 minutes

    const step1Hour = kstPlus2Min.getUTCHours()
    const step1Minute = kstPlus2Min.getUTCMinutes()

    chatbotLogger.info(
      `[Sequence Strategy] Setting Step 1 timing to KST ${step1Hour}:${step1Minute.toString().padStart(2, "0")} (2 minutes from now)`,
    )

    // Override Step 1 timing
    if (emailSteps[0]) {
      emailSteps[0].scheduled_hour = step1Hour
      emailSteps[0].scheduled_minute = step1Minute
      emailSteps[0].delay_days = 0 // Always 0 for Step 1
    }

    // Convert AI strategy to internal format
    const sequenceStrategy = {
      dominant_business_type: dominantBusinessType,
      avg_company_size: Math.round(avgCompanySize),
      company_size_category: companySizeCategory,
      avg_lead_score: Number.parseFloat(avgLeadScore.toFixed(1)),
      business_type_focus: businessTypeFocus,
      samples_analyzed: leadSamples.length,
      strategy_summary: aiStrategy.strategy_summary,
      timezone: aiStrategy.timezone || "Asia/Seoul",
      recommended_steps: aiStrategy.recommended_steps,
      email_steps: emailSteps, // Use AI-generated email content
      personalization_tips: aiStrategy.personalization_tips,
      expected_performance: aiStrategy.expected_performance,
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
      `Creating sequence with AI-generated strategy...`,
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
    // Find default email account for the workspace
    // ==================================================================================
    const emailAccountCheck = await db.execute(sql`
      SELECT id, email_address, display_name
      FROM user_email_accounts
      WHERE workspace_id = ${workspaceId}
        AND status = 'active'
      ORDER BY is_default DESC, created_at ASC
      LIMIT 1
    `)

    if (!emailAccountCheck.rows || emailAccountCheck.rows.length === 0) {
      throw new Error(
        "이메일 계정을 찾을 수 없습니다. 먼저 이메일 계정을 연결해주세요.\n" +
          "Settings > Email Accounts에서 이메일 계정을 추가할 수 있습니다.",
      )
    }

    const defaultEmailAccount = emailAccountCheck.rows[0] as {
      id: string
      email_address: string
      display_name: string
    }
    chatbotLogger.info(
      `[Sequence Generation] ✓ Found default email account: ${defaultEmailAccount.email_address}`,
    )

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
          "Executing CTE query to create sequence...",
        )
      }

      // Extract and escape email steps from AI-generated strategy
      const emailSteps = strategy.email_steps || []
      if (!emailSteps || emailSteps.length === 0) {
        throw new Error("No email steps found in strategy")
      }

      chatbotLogger.info(
        `[Sequence Generation] Building dynamic CTE query for ${emailSteps.length} steps`,
      )

      // Escape email content for SQL injection prevention
      const escapedSteps = emailSteps.map((step, index) => {
        const escapedSubject = step.email_subject.replace(/'/g, "''")
        const escapedBody = step.email_body.replace(/'/g, "''")

        chatbotLogger.nodeDetail(`escaped-step-${index + 1}`, {
          step_order: step.step_order,
          subject_length: escapedSubject.length,
          body_length: escapedBody.length,
          delay_days: step.delay_days,
          scheduled_hour: step.scheduled_hour,
          scheduled_minute: step.scheduled_minute,
          has_newlines: escapedBody.includes("\n"),
        })

        return {
          step_order: step.step_order,
          delay_days: step.delay_days,
          scheduled_hour: step.scheduled_hour,
          scheduled_minute: step.scheduled_minute,
          email_subject: escapedSubject,
          email_body: escapedBody,
        }
      })

      // ==================================================================================
      // Build Dynamic CTE Query
      // ==================================================================================
      // Generate CTE for each email step dynamically based on AI strategy
      // ==================================================================================

      const timezone = strategy.timezone || "Asia/Seoul"
      const strategySummary = strategy.strategy_summary || "AI-optimized email sequence"

      // Generate CTE for sequence creation
      let cteQuery = `
WITH
-- ==================================================================================
-- CTE 1: Create Sequence (PAUSED - requires user activation)
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
    '${strategySummary.replace(/'/g, "''")} (${samplesAnalyzed} samples analyzed)',
    'paused',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  RETURNING *
)`

      // Generate CTE for each email step
      escapedSteps.forEach((step, index) => {
        const stepNumber = index + 1
        const cteName = `new_sequence_step_${stepNumber}`

        cteQuery += `,

-- ==================================================================================
-- CTE ${stepNumber + 1}: Create Sequence Step ${stepNumber}
-- ==================================================================================
${cteName} AS (
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
    id,
    ${step.step_order},
    ${step.delay_days},
    ${step.scheduled_hour},
    ${step.scheduled_minute},
    '${timezone}',
    '${step.email_subject}',
    E'${step.email_body.replace(/\n/g, "\\n")}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM new_sequence
  RETURNING *
)`
      })

      // Generate final SELECT with UNION ALL for all steps
      const unionAllSteps = escapedSteps
        .map((_, index) => {
          const stepNumber = index + 1
          return `SELECT * FROM new_sequence_step_${stepNumber}`
        })
        .join("\n      UNION ALL ")

      // Add enrollment CTE - auto-enroll all leads from the customer group (PAUSED status)
      // Note: step_executions will be created when user activates the sequence
      cteQuery += `,

-- ==================================================================================
-- CTE: Auto-enroll all leads from customer group (PAUSED - awaiting activation)
-- ==================================================================================
new_enrollments AS (
  INSERT INTO sequence_enrollments (
    id,
    sequence_id,
    lead_id,
    user_email_account_id,
    current_step_order,
    status,
    enrolled_at,
    next_step_scheduled_at
  )
  SELECT
    gen_random_uuid(),
    (SELECT id FROM new_sequence),
    cgm.lead_id,
    '${defaultEmailAccount.id}',
    1,
    'paused',
    CURRENT_TIMESTAMP,
    NULL
  FROM customer_group_members cgm
  WHERE cgm.group_id = '${customerGroupId}'
  RETURNING *
)`

      cteQuery += `

-- ==================================================================================
-- Final SELECT: Return Comprehensive Summary
-- ==================================================================================
SELECT json_build_object(
  'sequence', (SELECT row_to_json(new_sequence.*) FROM new_sequence),
  'steps', (
    SELECT json_agg(row_to_json(steps.*) ORDER BY steps.step_order) FROM (
      ${unionAllSteps}
    ) steps
  ),
  'enrollments_count', (SELECT COUNT(*) FROM new_enrollments),
  'total_steps', ${escapedSteps.length},
  'status', 'paused',
  'linked_to_group', true,
  'customer_group_id', '${customerGroupId}',
  'customer_group_name', '${escapedGroupName}',
  'total_leads_in_group', ${membersCount},
  'email_account', json_build_object(
    'id', '${defaultEmailAccount.id}',
    'email', '${defaultEmailAccount.email_address}'
  ),
  'ai_analysis', json_build_object(
    'avg_lead_score', ${avgLeadScore.toFixed(1)},
    'dominant_business_type', '${escapedBusinessType}',
    'avg_company_size', ${Math.round(avgCompanySize)},
    'company_size_category', '${companySizeCategory}',
    'business_type_focus', '${businessTypeFocus}',
    'samples_analyzed', ${samplesAnalyzed},
    'strategy_summary', '${strategySummary.replace(/'/g, "''")}'
  ),
  'created_at', CURRENT_TIMESTAMP
) as result
`

      const sequenceGenerationQuery = sql.raw(cteQuery)

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
          enrollments_count: number
          total_steps: number
          total_leads_in_group: number
          customer_group_name: string
          email_account: {
            id: string
            email: string
          }
          created_at: string
          ai_analysis: {
            avg_lead_score: number
            dominant_business_type: string
            avg_company_size: number
            company_size_category: string
            business_type_focus: string
            samples_analyzed: number
            strategy_summary: string
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

      // Validation: Verify sequence status is paused (awaiting user activation)
      if (sequenceData.sequence.status !== "paused") {
        chatbotLogger.warn(
          `[Sequence Generation] Sequence created but status is not paused: ${sequenceData.sequence.status}`,
        )
      }

      // Validation: Check if steps were created
      const expectedSteps = escapedSteps.length
      if (!sequenceData.steps || sequenceData.steps.length !== expectedSteps) {
        chatbotLogger.error(
          `[Sequence Generation] Expected ${expectedSteps} steps but got ${sequenceData.steps?.length || 0}`,
        )
        throw new Error(
          `Failed to create all sequence steps. Expected ${expectedSteps} steps but created ${sequenceData.steps?.length || 0}.`,
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

    // Format detailed success message with AI strategy info
    const strategySummary = result.ai_analysis.strategy_summary || "AI-optimized strategy"
    const expectedPerformance = strategy.expected_performance
      ? `\n\n**Expected Performance (AI Prediction):**
- **Estimated Open Rate:** ${strategy.expected_performance.estimated_open_rate}
- **Estimated Response Rate:** ${strategy.expected_performance.estimated_response_rate}
- **Reasoning:** ${strategy.expected_performance.reasoning}`
      : ""

    const personalizationTips =
      strategy.personalization_tips && strategy.personalization_tips.length > 0
        ? `\n\n**Personalization Tips:**
${strategy.personalization_tips.map((tip) => `• ${tip}`).join("\n")}`
        : ""

    const successMessage = `
🎉 **AI-Optimized Sequence Created Successfully!**

**Sequence Details:**
- **Name:** ${result.sequence.name}
- **Status:** ⏸️ 일시정지 (사용자 승인 대기)
- **ID:** ${result.sequence.id}
- **Customer Group:** ${result.customer_group_name}
- **Recipients Enrolled:** ${result.enrollments_count}명
- **Sending From:** ${result.email_account.email}

**AI Strategy:**
- **Summary:** ${strategySummary}
- **Steps Generated:** ${result.total_steps} emails
${expectedPerformance}

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
${personalizationTips}

---

⏸️ **시퀀스가 일시정지 상태로 생성되었습니다.**
📝 **${result.enrollments_count}명**의 리드가 등록되어 실행 대기 중입니다.

👉 **시퀀스 내용을 검토한 후 "실행해줘" 또는 "시퀀스 시작해줘"라고 말씀해주시면 이메일 발송이 시작됩니다.**

💡 시퀀스 페이지에서 직접 내용을 확인하고 수정할 수도 있습니다: [시퀀스 편집](/sequences/edit?id=${result.sequence.id})
    `.trim()

    return new Command({
      goto: END,
      update: {
        analysis: successMessage,
        generatedSequenceId: result.sequence.id,
        pendingSequenceGeneration: false,
        sequenceGenerationRequest: undefined,
        // Store sequence info in metadata for later activation
        metadata: {
          ...(state.metadata || {}),
          pendingSequenceActivation: {
            sequenceId: result.sequence.id,
            sequenceName: result.sequence.name,
            customerGroupName: result.customer_group_name,
            enrollmentsCount: result.enrollments_count,
            totalSteps: result.total_steps,
          },
        },
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

/**
 * Build email prompt for a specific step using AITemplateGenerationService
 *
 * @param step - Step strategy from AI
 * @param leadAnalysis - Lead analysis data
 * @param strategySummary - Overall strategy summary
 * @returns Prompt string for email generation
 */
function buildStepEmailPrompt(
  step: {
    step_order: number
    purpose: string
    tone: string
    key_points: string[]
  },
  leadAnalysis: {
    samples: Array<{
      company_name: string | null
      business_type: string | null
      employee_count: string | null
      lead_score: number | null
      city: string | null
      country: string | null
    }>
    avgLeadScore: number
    dominantBusinessType: string
    avgCompanySize: number
    companySizeCategory: string
    businessTypeFocus: string
    customerGroupName: string
    totalMembers: number
  },
  strategySummary: string,
): string {
  const keyPointsText =
    step.key_points.length > 0
      ? `\n포함할 핵심 내용:\n${step.key_points.map((p) => `- ${p}`).join("\n")}`
      : ""

  return `[시퀀스 전략 컨텍스트]
전체 전략: ${strategySummary}

[이메일 스텝 정보]
스텝 번호: ${step.step_order}
목표: ${step.purpose}
톤앤매너: ${step.tone}
${keyPointsText}

[타겟 고객 정보]
고객 그룹: ${leadAnalysis.customerGroupName}
총 리드 수: ${leadAnalysis.totalMembers}명
주요 비즈니스 타입: ${leadAnalysis.dominantBusinessType}
평균 회사 규모: ${leadAnalysis.companySizeCategory} (약 ${Math.round(leadAnalysis.avgCompanySize)}명)
평균 리드 점수: ${leadAnalysis.avgLeadScore.toFixed(1)}/100

[중요 지침]
1. 위 정보를 바탕으로 ${step.purpose}에 적합한 이메일을 작성해주세요.
2. ${step.tone} 톤으로 작성해주세요.
3. 이메일 시퀀스의 ${step.step_order}번째 스텝임을 고려해주세요.
4. {{회사명}}, {{담당자명}} 등의 변수를 적절히 활용해주세요.
5. 명확한 Call-to-Action을 포함해주세요.`
}

/**
 * Node: handleSequenceActivation
 *
 * Activates a paused sequence by calling the activate-step-based API.
 * This node is triggered when user confirms they want to start the sequence.
 *
 * Flow:
 * 1. Check if sequenceActivationRequest exists
 * 2. Call activate-step-based API to activate the sequence
 * 3. The API will:
 *    - Update sequence status from 'paused' to 'active'
 *    - Update enrollment status from 'paused' to 'active'
 *    - Create step_executions with current time + 2 minutes
 * 4. Return success message
 */
export async function handleSequenceActivation(state: ChatbotState): Promise<Command> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("handleSequenceActivation")

  const emitter = state._emitter

  chatbotLogger.nodeDetail("handleSequenceActivation", {
    hasRequest: !!state.sequenceActivationRequest,
    sequenceId: state.sequenceActivationRequest?.sequenceId,
    sequenceName: state.sequenceActivationRequest?.sequenceName,
  })

  // If no request, skip to end
  if (!state.sequenceActivationRequest) {
    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("handleSequenceActivation (no request)", duration)

    return new Command({
      goto: END,
      update: {
        analysis: "활성화할 시퀀스가 없습니다.",
      },
    })
  }

  const { sequenceId, sequenceName, customerGroupName, enrollmentsCount, totalSteps } =
    state.sequenceActivationRequest

  if (emitter) {
    emitter.nodeStart("handleSequenceActivation", `"${sequenceName}" 시퀀스를 활성화하는 중...`)
  }

  try {
    // Call the activate-step-based API internally
    chatbotLogger.info(`[Sequence Activation] Activating sequence ${sequenceId}`)

    // Get API base URL from environment
    const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:3010"
    const activateUrl = `${apiBaseUrl}/api/v1/sequences/${sequenceId}/activate-step-based`

    const response = await fetch(activateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorData = (await response.json()) as { message?: string }
      throw new Error(errorData.message || `Failed to activate sequence: ${response.status}`)
    }

    const result = (await response.json()) as {
      success: boolean
      message: string
      stepsCount?: number
      alreadyActive?: boolean
    }

    const duration = Date.now() - startTime
    chatbotLogger.nodeSuccess("handleSequenceActivation", duration)

    if (emitter) {
      emitter.nodeComplete("handleSequenceActivation", `시퀀스가 활성화되었습니다!`, {
        sequenceId,
        success: true,
      })
    }

    // Build success message
    const alreadyActiveNote = result.alreadyActive ? " (이미 활성화된 상태입니다)" : ""
    const successMessage = `
🚀 **시퀀스가 활성화되었습니다!${alreadyActiveNote}**

**활성화된 시퀀스 정보:**
- **시퀀스명:** ${sequenceName || "AI-Generated Sequence"}
- **고객 그룹:** ${customerGroupName || "Unknown"}
- **등록된 리드:** ${enrollmentsCount || 0}명
- **총 스텝 수:** ${totalSteps || result.stepsCount || 0}개

✅ **첫 번째 이메일이 약 2분 후에 발송됩니다.**
✅ 이메일 발송 상태는 [시퀀스 페이지](/sequences/edit?id=${sequenceId})에서 확인하실 수 있습니다.

**알림:** 이메일 발송 후 오픈/클릭/답장 등의 성과 지표를 실시간으로 모니터링할 수 있습니다.
    `.trim()

    return new Command({
      goto: END,
      update: {
        analysis: successMessage,
        isSequenceActivationRequest: false,
        sequenceActivationRequest: undefined,
        // Clear the pending activation from metadata
        metadata: {
          ...(state.metadata || {}),
          pendingSequenceActivation: undefined,
        },
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const duration = Date.now() - startTime

    chatbotLogger.nodeError("handleSequenceActivation", errorMessage, duration)

    if (emitter) {
      emitter.error("handleSequenceActivation", `시퀀스 활성화 실패: ${errorMessage}`)
    }

    const failureMessage = `
❌ **시퀀스 활성화 실패**

**오류:** ${errorMessage}

**가능한 원인:**
- 시퀀스가 이미 삭제되었을 수 있습니다
- 이메일 계정이 설정되지 않았을 수 있습니다
- 네트워크 오류가 발생했을 수 있습니다

다시 시도하시거나 [시퀀스 페이지](/sequences)에서 직접 활성화해주세요.
    `.trim()

    return new Command({
      goto: END,
      update: {
        analysis: failureMessage,
        error: errorMessage,
      },
    })
  }
}
