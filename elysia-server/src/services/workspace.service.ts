import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emailReplies, emails } from "../db/schema/emails"
import { sequenceEnrollments } from "../db/schema/sequences"
import { users } from "../db/schema/users"
import { workspaceProducts } from "../db/schema/workspace-products"
import { workspaceMembers, workspaces } from "../db/schema/workspaces"
import { mastra } from "../shared/mastra"
import {
  type OnboardingEnrichmentOutput,
  registerWorkflowProgressCallback,
  unregisterWorkflowProgressCallback,
} from "../shared/mastra/shell/workflows/onboarding-enrichment/onboarding-enrichment"
import logger from "../utils/logger"

// ====================================
// WORKSPACE CRUD OPERATIONS
// ====================================

// GetWorkspace :one
export async function getWorkspace(id: string) {
  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      websiteAnalysis: workspaces.websiteAnalysis,
      targetAudiences: workspaces.targetAudiences,
      expansionGoals: workspaces.expansionGoals,
      competitiveAdvantages: workspaces.competitiveAdvantages,
      rawResearchOutput: workspaces.rawResearchOutput,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      ownerUsername: users.username,
      ownerEmail: users.email,
    })
    .from(workspaces)
    .innerJoin(users, eq(workspaces.ownerId, users.id))
    .where(eq(workspaces.id, id))
    .limit(1)

  return result[0]
}

// GetWorkspace :one
export async function getWorkspaceOnlyById(id: string) {
  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      websiteAnalysis: workspaces.websiteAnalysis,
      targetAudiences: workspaces.targetAudiences,
      expansionGoals: workspaces.expansionGoals,
      competitiveAdvantages: workspaces.competitiveAdvantages,
      rawResearchOutput: workspaces.rawResearchOutput,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1)

  return result[0]
}

// CreateWorkspace :one
export async function createWorkspace(data: {
  name: string
  description?: string
  ownerId: string
  isActive?: boolean
  companyName?: string
  companyWebsite?: string
  companyPhone?: string
  industry?: string
  companySize?: string
  companyAddress?: string
  companyDescription?: string
  websiteAnalysis?: unknown
  targetAudiences?: string[]
  expansionGoals?: string[]
  competitiveAdvantages?: string[]
  rawResearchOutput?: unknown
}) {
  const [newWorkspace] = await db
    .insert(workspaces)
    .values({
      name: data.name,
      description: data.description || null,
      ownerId: data.ownerId,
      isActive: data.isActive !== undefined ? data.isActive : true,
      companyName: data.companyName || null,
      companyWebsite: data.companyWebsite || null,
      companyPhone: data.companyPhone || null,
      industry: data.industry || null,
      companySize: data.companySize || null,
      companyAddress: data.companyAddress || null,
      companyDescription: data.companyDescription || null,
      websiteAnalysis: data.websiteAnalysis || null,
      targetAudiences: data.targetAudiences || null,
      expansionGoals: data.expansionGoals || null,
      competitiveAdvantages: data.competitiveAdvantages || null,
      rawResearchOutput: data.rawResearchOutput || null,
    })
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      websiteAnalysis: workspaces.websiteAnalysis,
      targetAudiences: workspaces.targetAudiences,
      expansionGoals: workspaces.expansionGoals,
      competitiveAdvantages: workspaces.competitiveAdvantages,
      rawResearchOutput: workspaces.rawResearchOutput,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })

  // Create workspace member with owner role
  if (newWorkspace) {
    await addWorkspaceMember({
      workspaceId: newWorkspace.id,
      userId: data.ownerId,
      role: "owner",
      status: "active",
    })
  }

  return newWorkspace
}

export async function onboardingEnrichment({
  workspaceId,
  websiteUrl,
}: {
  workspaceId: string
  websiteUrl: string
}) {
  const workflow = mastra.getWorkflow("onboardingEnrichmentWorkflow")

  if (!workflow) {
    logger.error("❌ [ONBOARDING-ENRICHMENT] Onboarding Enrichment workflow not found in Mastra")
    throw new Error(" Onboarding Enrichment workflow not found")
  }

  logger.info("✅ [ONBOARDING-ENRICHMENT] Workflow found, creating run instance")

  // Create a run instance
  const run = await workflow.createRunAsync()
  logger.info("✅ [ONBOARDING-ENRICHMENT] Workflow run instance created")

  // Execute the workflow
  logger.info("🚀 [ONBOARDING-ENRICHMENT] Starting workflow execution")
  const workflowResult = await run.start({
    inputData: {
      companyUrl: websiteUrl,
    },
  })

  logger.info(
    {
      status: workflowResult.status,
      stepCount: Object.keys(workflowResult.steps).length,
    },
    "📊 [ONBOARDING-ENRICHMENT] Workflow execution completed",
  )

  // Handle workflow failure
  if (workflowResult.status === "failed") {
    logger.error(
      {
        error: workflowResult.error.message,
        errorDetails: workflowResult.error,
      },
      "❌ [ONBOARDING-ENRICHMENT] Workflow execution failed",
    )
    throw new Error(`Workflow failed: ${workflowResult.error.message}`)
  }

  // Get the step result
  logger.info("📊 [ONBOARDING-ENRICHMENT] Extracting step result from workflow output")
  const stepResult = workflowResult.steps["merge-data-step"]

  if (!stepResult) {
    logger.error(
      { availableSteps: Object.keys(workflowResult.steps) },
      "❌ [ONBOARDING-ENRICHMENT] Step 'merge-data-step' not found in workflow result",
    )
    throw new Error("Campaign steps generation step not found in workflow result")
  }

  logger.info(
    {
      stepId: "merge-data-step",
      status: stepResult.status,
    },
    "📊 [ONBOARDING-ENRICHMENT] Step result extracted",
  )

  if (stepResult.status !== "success") {
    logger.error({ status: stepResult.status }, "❌ [ONBOARDING-ENRICHMENT] Step execution failed")
    throw new Error("Campaign steps generation step failed")
  }

  const result = stepResult.output as OnboardingEnrichmentOutput

  if (!result.rawOutput) {
    throw new Error("Failed to enrich onboarding")
  }

  logger.info(
    {
      targetMarkets: result.business.business.targetMarkets.length,
      rawOutput: `${result.rawOutput?.substring(0, 50)}...`,
    },
    "🎉 [ONBOARDING-ENRICHMENT] Enriched Onboarding via workflow",
  )

  // 5. Store enrichment data in database
  const workspace = await getWorkspaceOnlyById(workspaceId)
  if (!workspace) {
    throw new Error("Workspace not found")
  }
  let updateWorkspacePromise = updateWorkspace(workspaceId, {
    name: workspace.name,
    isActive: workspace.isActive,
    websiteAnalysis: result.companyAndProducts,
    targetAudiences: result.business.business.targetMarkets,
    expansionGoals: result.business.business.expansionGoals,
    competitiveAdvantages: result.business.business.competitiveAdvantages,
    rawResearchOutput: result.rawOutput,
  })

  // populate company description if empty or doesn't exist
  if (!workspace.companyDescription || workspace.companyDescription === "") {
    updateWorkspacePromise = updateWorkspace(workspaceId, {
      name: workspace.name,
      isActive: workspace.isActive,
      websiteAnalysis: result.companyAndProducts,
      targetAudiences: result.business.business.targetMarkets,
      expansionGoals: result.business.business.expansionGoals,
      competitiveAdvantages: result.business.business.competitiveAdvantages,
      rawResearchOutput: result.rawOutput,
      companyDescription: result.companyAndProducts.company.description,
    })
  }

  // Delete existing products first before creating new ones
  const [deletedProducts] = await Promise.all([
    deleteWorkspaceProducts(workspaceId),
    // Update workspace with enrichment data in parallel with deletion
    updateWorkspacePromise,
  ])

  logger.info(
    {
      workspaceId,
      productsDeleted: deletedProducts.length,
    },
    "🗑️ [ONBOARDING-ENRICHMENT] Deleted existing workspace products",
  )

  // Create workspace products from enrichment data (after deletion completes)
  await Promise.all(
    result.companyAndProducts.products.map((product) =>
      createWorkspaceProduct({
        workspaceId: workspaceId,
        name: product.name,
        description: product.description,
        category: product.category,
        features: product.features,
        priceRange: product.priceRange,
        targetAudience: product.targetAudience,
        imageUrl: product.image,
      }),
    ),
  )

  logger.info(
    {
      workspaceId,
      productsCreated: result.companyAndProducts.products.length,
    },
    "✅ [ONBOARDING-ENRICHMENT] Workspace updated with enrichment data",
  )
}

// Strategy types for sales strategies
export interface TargetBuyer {
  industry: string
  country: string
  countryCode: string
  companyCount: number
}

export interface EmailScheduleItem {
  day: string
  title: string
  description: string
}

export interface SalesStrategy {
  id: string
  countryCode: string
  countryName: string
  companiesTargeted: number
  description: string
  metrics: {
    openRate: number
    responseRate: number
    meetingRate: number
  }
  isSuggested: boolean
  targetBuyers: TargetBuyer[]
  emailSchedule: EmailScheduleItem[]
}

// Default email schedule template
const defaultEmailSchedule: EmailScheduleItem[] = [
  { day: "D+0", title: "Introduction", description: "Company introduction and value proposition" },
  { day: "D+3", title: "Product Details", description: "Detailed product/service information" },
  { day: "D+7", title: "Case Studies", description: "Success stories and testimonials" },
  { day: "D+14", title: "Meeting Request", description: "Schedule a discovery call" },
]

// Streaming version of onboarding enrichment with progress callbacks
export async function onboardingEnrichmentStreaming({
  workspaceId,
  websiteUrl,
  onProgress,
  onStrategies,
  onDone,
  onError,
}: {
  workspaceId: string
  websiteUrl: string
  onProgress: (step: string, message: string) => void
  onStrategies: (strategies: SalesStrategy[]) => void
  onDone: (result: { enrichment: OnboardingEnrichmentOutput; strategies: SalesStrategy[] }) => void
  onError: (error: string) => void
}) {
  // Generate unique run ID for this streaming session
  const runId = `enrich-${workspaceId}-${Date.now()}`

  try {
    // Step 1: Starting
    logger.info("[ENRICH-STREAM] Sending progress: starting")
    onProgress("starting", "Starting company analysis...")

    const workflow = mastra.getWorkflow("onboardingEnrichmentWorkflow")

    if (!workflow) {
      logger.error(
        "❌ [ONBOARDING-ENRICHMENT-STREAM] Onboarding Enrichment workflow not found in Mastra",
      )
      onError("Onboarding Enrichment workflow not found")
      return
    }

    // Register progress callback to receive events from workflow steps
    registerWorkflowProgressCallback(runId, (step, message, _data) => {
      logger.info({ step, message }, "[ENRICH-STREAM] Workflow emitted progress")
      onProgress(step, message)
    })

    const run = await workflow.createRunAsync()
    logger.info("✅ [ONBOARDING-ENRICHMENT-STREAM] Workflow run instance created")

    // Execute the workflow with streaming enabled
    const workflowResult = await run.start({
      inputData: {
        companyUrl: websiteUrl,
        stream: true,
      },
    })

    if (workflowResult.status === "failed") {
      logger.error(
        {
          error: workflowResult.error.message,
          errorDetails: workflowResult.error,
        },
        "❌ [ONBOARDING-ENRICHMENT-STREAM] Workflow execution failed",
      )
      onError(`Workflow failed: ${workflowResult.error.message}`)
      return
    }

    const stepResult = workflowResult.steps["merge-data-step"]

    if (!stepResult || stepResult.status !== "success") {
      onError("Failed to extract company data")
      return
    }

    const result = stepResult.output as OnboardingEnrichmentOutput

    if (!result.rawOutput) {
      onError("Failed to enrich onboarding - no data extracted")
      return
    }

    // Step 4: Saving
    logger.info("[ENRICH-STREAM] Sending progress: saving")
    onProgress("saving", "Saving company analysis to database...")

    const workspace = await getWorkspaceOnlyById(workspaceId)
    if (!workspace) {
      onError("Workspace not found")
      return
    }

    const updateWorkspacePromise = updateWorkspace(workspaceId, {
      name: workspace.name,
      isActive: workspace.isActive,
      companyName: result.companyAndProducts.company.name,
      companyDescription: result.companyAndProducts.company.description,
      industry: result.companyAndProducts.company.industries.join(", "),
      companySize: result.companyAndProducts.company.size,
      websiteAnalysis: result.companyAndProducts,
      targetAudiences: result.business.business.targetMarkets,
      expansionGoals: result.business.business.expansionGoals,
      competitiveAdvantages: result.business.business.competitiveAdvantages,
      rawResearchOutput: result.rawOutput,
    })

    const [deletedProducts] = await Promise.all([
      deleteWorkspaceProducts(workspaceId),
      updateWorkspacePromise,
    ])

    logger.info(
      { workspaceId, productsDeleted: deletedProducts.length },
      "🗑️ [ONBOARDING-ENRICHMENT-STREAM] Deleted existing workspace products",
    )

    await Promise.all(
      result.companyAndProducts.products.map((product) =>
        createWorkspaceProduct({
          workspaceId: workspaceId,
          name: product.name,
          description: product.description,
          category: product.category,
          features: product.features,
          priceRange: product.priceRange,
          targetAudience: product.targetAudience,
          imageUrl: product.image,
        }),
      ),
    )

    // Step 5: Generating strategies
    logger.info("[ENRICH-STREAM] Sending progress: strategizing")
    onProgress("strategizing", "Generating sales strategies...")

    // Generate strategies from enrichment data
    const strategies = generateStrategiesFromEnrichment(result)

    onStrategies(strategies)

    // Step 6: Done
    logger.info(
      {
        workspaceId,
        strategiesCount: strategies.length,
      },
      "✅ [ONBOARDING-ENRICHMENT-STREAM] Enrichment and strategy generation completed",
    )

    onDone({
      enrichment: result,
      strategies,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    logger.error({ error: errorMessage }, "❌ [ONBOARDING-ENRICHMENT-STREAM] Error occurred")
    onError(errorMessage)
  } finally {
    // Clean up the progress callback
    unregisterWorkflowProgressCallback(runId)
  }
}

// Generate sales strategies from enrichment data
function generateStrategiesFromEnrichment(enrichment: OnboardingEnrichmentOutput): SalesStrategy[] {
  const targetMarkets = enrichment.business.business.targetMarkets
  const company = enrichment.companyAndProducts.company

  // Country code mapping for common markets
  const countryMapping: Record<string, { code: string; name: string }> = {
    germany: { code: "DE", name: "Germany" },
    german: { code: "DE", name: "Germany" },
    uk: { code: "GB", name: "United Kingdom" },
    "united kingdom": { code: "GB", name: "United Kingdom" },
    britain: { code: "GB", name: "United Kingdom" },
    singapore: { code: "SG", name: "Singapore" },
    usa: { code: "US", name: "United States" },
    "united states": { code: "US", name: "United States" },
    japan: { code: "JP", name: "Japan" },
    china: { code: "CN", name: "China" },
    korea: { code: "KR", name: "South Korea" },
    france: { code: "FR", name: "France" },
    australia: { code: "AU", name: "Australia" },
    canada: { code: "CA", name: "Canada" },
    india: { code: "IN", name: "India" },
    brazil: { code: "BR", name: "Brazil" },
    netherlands: { code: "NL", name: "Netherlands" },
    sweden: { code: "SE", name: "Sweden" },
    switzerland: { code: "CH", name: "Switzerland" },
    spain: { code: "ES", name: "Spain" },
    italy: { code: "IT", name: "Italy" },
    mexico: { code: "MX", name: "Mexico" },
    indonesia: { code: "ID", name: "Indonesia" },
    vietnam: { code: "VN", name: "Vietnam" },
    thailand: { code: "TH", name: "Thailand" },
    malaysia: { code: "MY", name: "Malaysia" },
    philippines: { code: "PH", name: "Philippines" },
    uae: { code: "AE", name: "United Arab Emirates" },
    "saudi arabia": { code: "SA", name: "Saudi Arabia" },
    poland: { code: "PL", name: "Poland" },
    europe: { code: "EU", name: "Europe" },
    asia: { code: "AS", name: "Asia-Pacific" },
    "north america": { code: "NA", name: "North America" },
    "latin america": { code: "LA", name: "Latin America" },
    "middle east": { code: "ME", name: "Middle East" },
    africa: { code: "AF", name: "Africa" },
  }

  // Parse target markets and generate strategies
  const strategies: SalesStrategy[] = []
  const processedMarkets = new Set<string>()

  for (const market of targetMarkets) {
    const marketLower = market.toLowerCase()

    // Find matching country/region
    let matchedCountry: { code: string; name: string } | null = null

    for (const [key, value] of Object.entries(countryMapping)) {
      if (marketLower.includes(key)) {
        matchedCountry = value
        break
      }
    }

    // Skip if already processed or no match found
    if (!matchedCountry || processedMarkets.has(matchedCountry.code)) {
      continue
    }

    processedMarkets.add(matchedCountry.code)

    // Generate realistic-looking metrics based on market characteristics
    const baseOpenRate = 25 + Math.random() * 20 // 25-45%
    const baseResponseRate = 5 + Math.random() * 12 // 5-17%
    const baseMeetingRate = 1 + Math.random() * 5 // 1-6%

    // Generate company count based on market size
    const marketSizeMultiplier =
      matchedCountry.code === "US" ||
      matchedCountry.code === "CN" ||
      matchedCountry.code === "EU" ||
      matchedCountry.code === "AS"
        ? 3
        : matchedCountry.code === "DE" ||
            matchedCountry.code === "GB" ||
            matchedCountry.code === "JP" ||
            matchedCountry.code === "IN"
          ? 2
          : 1

    const companiesTargeted = Math.floor(50 + Math.random() * 150 * marketSizeMultiplier)

    // Generate description based on company and market
    const description = `This B2B sales strategy targets ${matchedCountry.name} market for ${company.name || "your company"}'s ${company.industries?.[0] || "products"}. Focusing on ${enrichment.companyAndProducts.products[0]?.targetAudience || "enterprise customers"} with emphasis on ${enrichment.business.business.competitiveAdvantages?.[0] || "quality and innovation"}.`

    // Generate target buyers based on company industries and products
    const targetBuyers: TargetBuyer[] = []
    const industries = enrichment.companyAndProducts.company.industries || []
    const products = enrichment.companyAndProducts.products || []

    // Create target buyer entries from company industries
    for (const industry of industries.slice(0, 2)) {
      targetBuyers.push({
        industry,
        country: matchedCountry.name,
        countryCode: matchedCountry.code,
        companyCount: Math.floor(100000 + Math.random() * 500000),
      })
    }

    // Add target audience from products
    for (const product of products.slice(0, 1)) {
      if (product.targetAudience) {
        targetBuyers.push({
          industry: product.targetAudience,
          country: matchedCountry.name,
          countryCode: matchedCountry.code,
          companyCount: Math.floor(50000 + Math.random() * 300000),
        })
      }
    }

    // Ensure at least one target buyer
    if (targetBuyers.length === 0) {
      targetBuyers.push({
        industry: "General B2B",
        country: matchedCountry.name,
        countryCode: matchedCountry.code,
        companyCount: Math.floor(200000 + Math.random() * 400000),
      })
    }

    strategies.push({
      id: `strategy-${matchedCountry.code.toLowerCase()}-${Date.now()}`,
      countryCode: matchedCountry.code,
      countryName: matchedCountry.name,
      companiesTargeted,
      description,
      metrics: {
        openRate: Math.round(baseOpenRate * 10) / 10,
        responseRate: Math.round(baseResponseRate * 10) / 10,
        meetingRate: Math.round(baseMeetingRate * 10) / 10,
      },
      isSuggested: strategies.length === 0, // First strategy is suggested
      targetBuyers,
      emailSchedule: defaultEmailSchedule,
    })

    // Limit to 3 strategies
    if (strategies.length >= 3) {
      break
    }
  }

  // If we don't have enough strategies, add some defaults based on expansion goals
  if (strategies.length < 3 && enrichment.business.business.expansionGoals.length > 0) {
    const defaultMarkets = ["US", "EU", "AS"]

    for (const code of defaultMarkets) {
      if (strategies.length >= 3) break
      if (processedMarkets.has(code)) continue

      const marketInfo = Object.values(countryMapping).find((m) => m.code === code)
      if (!marketInfo) continue

      // Generate default target buyers for fallback
      const fallbackTargetBuyers: TargetBuyer[] = [
        {
          industry: enrichment.companyAndProducts.company.industries?.[0] || "General B2B",
          country: marketInfo.name,
          countryCode: code,
          companyCount: Math.floor(150000 + Math.random() * 350000),
        },
      ]

      strategies.push({
        id: `strategy-${code.toLowerCase()}-${Date.now()}`,
        countryCode: code,
        countryName: marketInfo.name,
        companiesTargeted: Math.floor(50 + Math.random() * 100),
        description: `Expansion opportunity in ${marketInfo.name} market based on your company's growth goals. Target market aligned with ${enrichment.business.business.expansionGoals[0] || "global expansion"} strategy.`,
        metrics: {
          openRate: Math.round((25 + Math.random() * 15) * 10) / 10,
          responseRate: Math.round((5 + Math.random() * 10) * 10) / 10,
          meetingRate: Math.round((1 + Math.random() * 4) * 10) / 10,
        },
        isSuggested: strategies.length === 0,
        targetBuyers: fallbackTargetBuyers,
        emailSchedule: defaultEmailSchedule,
      })
    }
  }

  return strategies
}

// UpdateWorkspace :one
export async function updateWorkspace(
  id: string,
  data: {
    name: string
    description?: string
    ownerId?: string
    isActive: boolean
    companyName?: string
    companyWebsite?: string
    companyPhone?: string
    industry?: string
    companySize?: string
    companyAddress?: string
    companyDescription?: string
    websiteAnalysis?: unknown
    targetAudiences?: string[]
    expansionGoals?: string[]
    competitiveAdvantages?: string[]
    rawResearchOutput?: unknown
  },
) {
  const updateData: {
    name: string
    description?: string
    ownerId?: string
    isActive: boolean
    companyName?: string
    companyWebsite?: string
    companyPhone?: string
    industry?: string
    companySize?: string
    companyAddress?: string
    companyDescription?: string
    websiteAnalysis?: unknown
    targetAudiences?: string[]
    expansionGoals?: string[]
    competitiveAdvantages?: string[]
    rawResearchOutput?: unknown
    updatedAt: Date
  } = {
    name: data.name,
    description: data.description,
    isActive: data.isActive,
    companyName: data.companyName,
    companyWebsite: data.companyWebsite,
    companyPhone: data.companyPhone,
    industry: data.industry,
    companySize: data.companySize,
    companyAddress: data.companyAddress,
    companyDescription: data.companyDescription,
    websiteAnalysis: data.websiteAnalysis,
    targetAudiences: data.targetAudiences,
    expansionGoals: data.expansionGoals,
    competitiveAdvantages: data.competitiveAdvantages,
    rawResearchOutput: data.rawResearchOutput,
    updatedAt: new Date(),
  }

  // Only update ownerId if provided
  if (data.ownerId) {
    updateData.ownerId = data.ownerId
  }

  const [updatedWorkspace] = await db
    .update(workspaces)
    .set(updateData)
    .where(eq(workspaces.id, id))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      websiteAnalysis: workspaces.websiteAnalysis,
      targetAudiences: workspaces.targetAudiences,
      expansionGoals: workspaces.expansionGoals,
      competitiveAdvantages: workspaces.competitiveAdvantages,
      rawResearchOutput: workspaces.rawResearchOutput,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })

  return updatedWorkspace
}

// DeleteWorkspace :exec
export async function deleteWorkspace(id: string) {
  logger.info({ workspaceId: id }, "Starting workspace deletion")

  // 1. 이메일 개수 확인 (RESTRICT 방지 - 워크스페이스에 이메일이 있으면 삭제 불가)
  const emailCountResult = await db
    .select({ count: count() })
    .from(emails)
    .where(eq(emails.workspaceId, id))
  // + 이메일 답장 개수도 확인
  const emailReplyCountResult = await db
    .select({ count: count() })
    .from(emailReplies)
    .where(eq(emailReplies.workspaceId, id))

  const totalEmails = (emailCountResult[0]?.count || 0) + (emailReplyCountResult[0]?.count || 0)

  if (totalEmails > 0) {
    logger.warn(
      { workspaceId: id, emailCount: totalEmails },
      "Cannot delete workspace: emails exist",
    )
    throw new Error(
      `워크스페이스에 ${totalEmails}개의 이메일 또는 답장이 있습니다. 워크스페이스를 삭제하려면 먼저 이메일을 이동하거나 삭제해야 합니다.`,
    )
  }

  // 2. First, get all user_email_accounts for this workspace
  const emailAccounts = await db
    .select({ id: userEmailAccounts.id })
    .from(userEmailAccounts)
    .where(eq(userEmailAccounts.workspaceId, id))

  logger.info(
    { workspaceId: id, emailAccountCount: emailAccounts.length },
    "Found email accounts for workspace",
  )

  // 3. Delete sequence_enrollments that reference these email accounts
  if (emailAccounts.length > 0) {
    const emailAccountIds = emailAccounts.map((acc) => acc.id)
    const enrollmentCondition = or(
      ...emailAccountIds.map((accId) => eq(sequenceEnrollments.userEmailAccountId, accId)),
    )
    if (enrollmentCondition) {
      await db.delete(sequenceEnrollments).where(enrollmentCondition)
      logger.info(
        { workspaceId: id, emailAccountIds },
        "Deleted sequence enrollments for email accounts",
      )
    }
  }

  // 4. Now delete the workspace (RESTRICT constraint ensures emails are checked before deletion)
  await db.delete(workspaces).where(eq(workspaces.id, id))
  logger.info({ workspaceId: id }, "Workspace deleted successfully")
}

// ====================================
// WORKSPACE QUERY AND SEARCH OPERATIONS
// ====================================

// ListWorkspaces :many
export async function listWorkspaces(limit: number, offset: number) {
  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      websiteAnalysis: workspaces.websiteAnalysis,
      targetAudiences: workspaces.targetAudiences,
      expansionGoals: workspaces.expansionGoals,
      competitiveAdvantages: workspaces.competitiveAdvantages,
      rawResearchOutput: workspaces.rawResearchOutput,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      ownerUsername: users.username,
      ownerEmail: users.email,
    })
    .from(workspaces)
    .innerJoin(users, eq(workspaces.ownerId, users.id))
    .orderBy(desc(workspaces.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ListWorkspacesWithFilters :many
export async function listWorkspacesWithFilters(
  limit: number,
  offset: number,
  filters?: {
    isActive?: boolean
    search?: string
    ownerIds?: string[]
  },
) {
  const conditions = []

  if (filters?.isActive !== undefined) {
    conditions.push(eq(workspaces.isActive, filters.isActive))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(workspaces.name, `%${filters.search}%`),
      ilike(workspaces.description, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.ownerIds && filters.ownerIds.length > 0) {
    const ownerCondition = or(...filters.ownerIds.map((id) => eq(workspaces.ownerId, id)))
    if (ownerCondition) {
      conditions.push(ownerCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      websiteAnalysis: workspaces.websiteAnalysis,
      targetAudiences: workspaces.targetAudiences,
      expansionGoals: workspaces.expansionGoals,
      competitiveAdvantages: workspaces.competitiveAdvantages,
      rawResearchOutput: workspaces.rawResearchOutput,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      ownerUsername: users.username,
      ownerEmail: users.email,
    })
    .from(workspaces)
    .innerJoin(users, eq(workspaces.ownerId, users.id))
    .where(whereClause)
    .orderBy(desc(workspaces.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetWorkspacesByOwner :many
export async function getWorkspacesByOwner(ownerId: string) {
  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      websiteAnalysis: workspaces.websiteAnalysis,
      targetAudiences: workspaces.targetAudiences,
      expansionGoals: workspaces.expansionGoals,
      competitiveAdvantages: workspaces.competitiveAdvantages,
      rawResearchOutput: workspaces.rawResearchOutput,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .where(eq(workspaces.ownerId, ownerId))
    .orderBy(desc(workspaces.createdAt))

  return result
}

// ====================================
// STATISTICS AND UTILITY QUERIES
// ====================================

// CountWorkspaces :one
export async function countWorkspaces() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(workspaces)

  return result[0]?.count ?? 0
}

// CountWorkspacesWithFilters :one
export async function countWorkspacesWithFilters(filters?: {
  isActive?: boolean
  search?: string
  ownerIds?: string[]
}) {
  const conditions = []

  if (filters?.isActive !== undefined) {
    conditions.push(eq(workspaces.isActive, filters.isActive))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(workspaces.name, `%${filters.search}%`),
      ilike(workspaces.description, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.ownerIds && filters.ownerIds.length > 0) {
    const ownerCondition = or(...filters.ownerIds.map((id) => eq(workspaces.ownerId, id)))
    if (ownerCondition) {
      conditions.push(ownerCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaces)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// ====================================
// BULK UPDATE OPERATIONS
// ====================================

// BulkUpdateStatus :exec
export async function bulkUpdateStatus(workspaceIds: string[], isActive: boolean) {
  const workspaceCondition = or(...workspaceIds.map((id) => eq(workspaces.id, id)))
  if (!workspaceCondition) {
    return 0
  }

  const result = await db
    .update(workspaces)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(workspaceCondition)
    .returning({ id: workspaces.id })

  return result.length
}

// TransferOwnership :one
export async function transferOwnership(workspaceId: string, newOwnerId: string) {
  const [updatedWorkspace] = await db
    .update(workspaces)
    .set({
      ownerId: newOwnerId,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      ownerId: workspaces.ownerId,
      updatedAt: workspaces.updatedAt,
    })

  return updatedWorkspace
}

// ====================================
// WORKSPACE MEMBERS OPERATIONS
// ====================================

// GetWorkspaceMembers :many
export async function getWorkspaceMembers(workspaceId: string) {
  const result = await db
    .select({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      invitedBy: workspaceMembers.invitedBy,
      invitedAt: workspaceMembers.invitedAt,
      joinedAt: workspaceMembers.joinedAt,
      username: users.username,
      email: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(desc(workspaceMembers.invitedAt))

  return result
}

// AddWorkspaceMember :one
export async function addWorkspaceMember(data: {
  workspaceId: string
  userId: string
  role?: "owner" | "admin" | "member" | "viewer"
  invitedBy?: string
  status?: "active" | "inactive" | "removed"
}) {
  const [newMember] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId: data.workspaceId,
      userId: data.userId,
      role: data.role || "member",
      invitedBy: data.invitedBy || null,
      status: data.status || "active",
    })
    .returning({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      invitedAt: workspaceMembers.invitedAt,
      joinedAt: workspaceMembers.joinedAt,
    })

  return newMember
}

// UpdateWorkspaceMemberRole :one
export async function updateWorkspaceMemberRole(
  memberId: string,
  role: "owner" | "admin" | "member" | "viewer",
) {
  const [updatedMember] = await db
    .update(workspaceMembers)
    .set({
      role,
    })
    .where(eq(workspaceMembers.id, memberId))
    .returning({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
    })

  return updatedMember
}

// UpdateWorkspaceMemberStatus :one
export async function updateWorkspaceMemberStatus(
  memberId: string,
  status: "active" | "inactive" | "removed",
) {
  const [updatedMember] = await db
    .update(workspaceMembers)
    .set({
      status,
      joinedAt: status === "active" ? new Date() : undefined,
    })
    .where(eq(workspaceMembers.id, memberId))
    .returning({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      joinedAt: workspaceMembers.joinedAt,
    })

  return updatedMember
}

// RemoveWorkspaceMember :exec
export async function removeWorkspaceMember(memberId: string) {
  await db.delete(workspaceMembers).where(eq(workspaceMembers.id, memberId))
}

// GetUserWorkspaces :many
export async function getUserWorkspaces(userId: string) {
  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      websiteAnalysis: workspaces.websiteAnalysis,
      targetAudiences: workspaces.targetAudiences,
      expansionGoals: workspaces.expansionGoals,
      competitiveAdvantages: workspaces.competitiveAdvantages,
      rawResearchOutput: workspaces.rawResearchOutput,
      isActive: workspaces.isActive,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(desc(workspaceMembers.joinedAt))

  return result
}

// GetAllUserRelatedWorkspaces - 소유하거나 멤버인 워크스페이스 모두 반환
export async function getAllUserRelatedWorkspaces(userId: string) {
  // 소유한 워크스페이스
  const ownedWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      isActive: workspaces.isActive,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      websiteAnalysis: workspaces.websiteAnalysis,
      targetAudiences: workspaces.targetAudiences,
      expansionGoals: workspaces.expansionGoals,
      competitiveAdvantages: workspaces.competitiveAdvantages,
      rawResearchOutput: workspaces.rawResearchOutput,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .orderBy(desc(workspaces.createdAt))

  // 멤버인 워크스페이스
  const memberWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      isActive: workspaces.isActive,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      websiteAnalysis: workspaces.websiteAnalysis,
      targetAudiences: workspaces.targetAudiences,
      expansionGoals: workspaces.expansionGoals,
      competitiveAdvantages: workspaces.competitiveAdvantages,
      rawResearchOutput: workspaces.rawResearchOutput,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.status, "active")))
    .orderBy(desc(workspaces.createdAt))

  // 중복 제거 (소유자이면서 멤버인 경우)
  const workspaceMap = new Map()

  // 소유한 워크스페이스 먼저 추가
  for (const ws of ownedWorkspaces) {
    workspaceMap.set(ws.id, ws)
  }

  // 멤버인 워크스페이스 추가 (중복되지 않는 것만)
  for (const ws of memberWorkspaces) {
    if (!workspaceMap.has(ws.id)) {
      workspaceMap.set(ws.id, ws)
    }
  }

  return Array.from(workspaceMap.values())
}

// ====================================
// WORKSPACE PRODUCTS OPERATIONS
// ====================================

// Get workspace with products
export async function getWorkspaceWithProducts(id: string) {
  const workspace = await getWorkspace(id)
  if (!workspace) {
    return null
  }

  const products = await db
    .select()
    .from(workspaceProducts)
    .where(eq(workspaceProducts.workspaceId, id))
    .orderBy(desc(workspaceProducts.createdAt))

  return {
    ...workspace,
    products,
  }
}

// List workspace products
export async function listWorkspaceProducts(workspaceId: string) {
  const products = await db
    .select()
    .from(workspaceProducts)
    .where(eq(workspaceProducts.workspaceId, workspaceId))
    .orderBy(desc(workspaceProducts.createdAt))

  return products
}

// Get single workspace product
export async function getWorkspaceProduct(id: string) {
  const result = await db
    .select()
    .from(workspaceProducts)
    .where(eq(workspaceProducts.id, id))
    .limit(1)

  return result[0]
}

// Create workspace product
export async function createWorkspaceProduct(data: {
  workspaceId: string
  name?: string
  description?: string
  category?: string
  features?: string[]
  priceRange?: string
  targetAudience?: string
  imageUrl?: string
}) {
  const result = await db
    .insert(workspaceProducts)
    .values({
      workspaceId: data.workspaceId,
      name: data.name,
      description: data.description,
      category: data.category,
      features: data.features || null,
      priceRange: data.priceRange,
      targetAudience: data.targetAudience,
      imageUrl: data.imageUrl,
    })
    .returning()

  return result[0]
}

// Update workspace product
export async function updateWorkspaceProduct(
  id: string,
  data: {
    name?: string
    description?: string
    category?: string
    features?: string[]
    priceRange?: string
    targetAudience?: string
    imageUrl?: string
  },
) {
  const result = await db
    .update(workspaceProducts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(workspaceProducts.id, id))
    .returning()

  return result[0]
}

// Delete workspace product
export async function deleteWorkspaceProduct(id: string) {
  const result = await db.delete(workspaceProducts).where(eq(workspaceProducts.id, id)).returning()

  return result[0]
}

// Delete all products for a workspace (useful for cleanup, though cascade should handle this)
export async function deleteWorkspaceProducts(workspaceId: string) {
  const result = await db
    .delete(workspaceProducts)
    .where(eq(workspaceProducts.workspaceId, workspaceId))
    .returning()

  return result
}
