import { and, count, desc, eq, ilike, isNotNull, ne, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import {
  billingCustomers,
  billingPlans,
  billingProducts,
  subscriptionHistory,
  subscriptions,
} from "../db/schema/billing"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emailReplies, emails } from "../db/schema/emails"
import { leads } from "../db/schema/leads"
import { sequenceEnrollments, sequences } from "../db/schema/sequences"
import { users } from "../db/schema/users"
import { workspaceProducts } from "../db/schema/workspace-products"
import { workspaceMembers, workspaces } from "../db/schema/workspaces"
import { createDefaultRolesForWorkspace, syncMemberRoleToIamRole } from "../db/seed-iam"
import { mastra } from "../shared/mastra"
import {
  type OnboardingEnrichmentOutput,
  registerWorkflowProgressCallback,
  unregisterWorkflowProgressCallback,
} from "../shared/mastra/shell/workflows/onboarding-enrichment/onboarding-enrichment"
import logger from "../utils/logger"
import { deleteGrant } from "./nylas.service"
import * as salesStrategyService from "./sales-strategy.service"

// ====================================
// BILLING HELPERS (워크스페이스 생성 시 사용)
// ====================================

/**
 * Trial 등급의 기본 요금제 조회
 * 데이터베이스에서 동적으로 조회하여 하드코딩 방지
 */
async function getDefaultTrialPlan(): Promise<{
  id: string
  trialDays: number | null
  productName: string
} | null> {
  // billing_products에서 tier='trial'인 상품과 연결된 기본 요금제 조회
  const [trialPlan] = await db
    .select({
      id: billingPlans.id,
      trialDays: billingPlans.trialDays,
      productName: billingProducts.name,
    })
    .from(billingPlans)
    .innerJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
    .where(
      and(
        eq(billingProducts.tier, "trial"),
        eq(billingProducts.isActive, true),
        eq(billingPlans.isActive, true),
        eq(billingPlans.isDefault, true),
      ),
    )
    .limit(1)

  if (trialPlan) {
    return trialPlan
  }

  // is_default가 없으면 trial tier의 첫 번째 활성 요금제 반환
  const [fallbackPlan] = await db
    .select({
      id: billingPlans.id,
      trialDays: billingPlans.trialDays,
      productName: billingProducts.name,
    })
    .from(billingPlans)
    .innerJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
    .where(
      and(
        eq(billingProducts.tier, "trial"),
        eq(billingProducts.isActive, true),
        eq(billingPlans.isActive, true),
      ),
    )
    .orderBy(billingProducts.displayOrder, billingPlans.createdAt)
    .limit(1)

  return fallbackPlan || null
}

/**
 * 사용자의 Billing Customer를 조회하거나 생성
 * 워크스페이스 생성 시 구독을 위해 필요
 */
async function getOrCreateBillingCustomer(userId: string): Promise<{ id: string }> {
  // 기존 고객 조회
  const [existingCustomer] = await db
    .select({ id: billingCustomers.id })
    .from(billingCustomers)
    .where(eq(billingCustomers.userId, userId))
    .limit(1)

  if (existingCustomer) {
    return existingCustomer
  }

  // 사용자 정보 조회
  const [user] = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // 새 고객 생성 (외부 결제 시스템 연동 전이므로 internal ID 사용)
  const [newCustomer] = await db
    .insert(billingCustomers)
    .values({
      userId,
      externalCustomerId: `internal_${userId}`,
      email: user.email,
      name: user.username,
    })
    .returning({ id: billingCustomers.id })

  if (!newCustomer) {
    throw new Error(`Failed to create billing customer for user: ${userId}`)
  }
  logger.info({ userId, customerId: newCustomer.id }, "Created billing customer for user")
  return newCustomer
}

/**
 * 워크스페이스에 Trial 구독 생성
 * 새 워크스페이스는 기본적으로 Trial(체험판) 등급으로 시작
 * 데이터베이스에서 동적으로 Trial 요금제 조회
 */
async function createTrialSubscription(
  workspaceId: string,
  customerId: string,
): Promise<{ id: string }> {
  // 데이터베이스에서 Trial 요금제 동적 조회
  const trialPlan = await getDefaultTrialPlan()

  if (!trialPlan) {
    logger.warn("No trial plan found in database, skipping subscription creation")
    throw new Error(
      "Trial plan not found. Please run seed-permission-system.sql to create billing products and plans.",
    )
  }

  const now = new Date()
  const trialEnd = new Date(now)
  trialEnd.setDate(trialEnd.getDate() + (trialPlan.trialDays || 7))

  // 구독 생성
  const [subscription] = await db
    .insert(subscriptions)
    .values({
      workspaceId,
      customerId,
      planId: trialPlan.id,
      status: "trialing",
      isPrimary: true,
      quantity: 1,
      trialStart: now,
      trialEnd: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
    })
    .returning({ id: subscriptions.id })

  if (!subscription) {
    throw new Error(`Failed to create trial subscription for workspace: ${workspaceId}`)
  }

  // 구독 이력 생성
  await db.insert(subscriptionHistory).values({
    subscriptionId: subscription.id,
    newPlanId: trialPlan.id,
    newStatus: "trialing",
    changeType: "created",
    changeReason: "워크스페이스 생성 시 자동 Trial 구독",
  })

  logger.info(
    {
      workspaceId,
      subscriptionId: subscription.id,
      planId: trialPlan.id,
      planName: trialPlan.productName,
      trialEnd: trialEnd.toISOString(),
    },
    "Created trial subscription for workspace",
  )

  return subscription
}

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

  // Create workspace member with owner role and IAM roles
  if (newWorkspace) {
    // Create default IAM roles for the workspace
    await createDefaultRolesForWorkspace(newWorkspace.id)

    // Add owner as workspace member (IAM sync will be handled automatically by addWorkspaceMember)
    await addWorkspaceMember({
      workspaceId: newWorkspace.id,
      userId: data.ownerId,
      role: "owner",
      status: "active",
    })

    // Create trial subscription for the workspace (default lowest permission)
    try {
      const billingCustomer = await getOrCreateBillingCustomer(data.ownerId)
      await createTrialSubscription(newWorkspace.id, billingCustomer.id)
      logger.info(
        { workspaceId: newWorkspace.id, ownerId: data.ownerId },
        "Workspace created with trial subscription (Level 1)",
      )
    } catch (error) {
      // Trial 구독 생성 실패해도 워크스페이스 생성은 계속 진행
      // 나중에 수동으로 구독을 추가할 수 있음
      logger.warn(
        { error, workspaceId: newWorkspace.id },
        "Failed to create trial subscription for workspace, continuing without subscription",
      )
    }
  }

  return newWorkspace
}

// ====================================
// ENRICHMENT CACHING HELPERS
// ====================================

// Normalize URL for consistent comparison
function normalizeWebsiteUrl(url: string): string {
  let normalized = url.trim().toLowerCase()
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = `https://${normalized}`
  }
  // Remove trailing slash
  normalized = normalized.replace(/\/+$/, "")
  return normalized
}

// Find workspace by website URL (for caching enrichment data)
export async function findWorkspaceByWebsite(websiteUrl: string, excludeWorkspaceId?: string) {
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl)
  // Extract domain without protocol for flexible matching
  const domainOnly = normalizedUrl.replace(/^https?:\/\//, "")

  const conditions = []

  // Build conditions based on whether we have an excludeWorkspaceId
  if (excludeWorkspaceId) {
    conditions.push(
      and(
        or(
          eq(workspaces.companyWebsite, normalizedUrl),
          sql`LOWER(${workspaces.companyWebsite}) LIKE ${`%${domainOnly}%`}`,
        ),
        isNotNull(workspaces.websiteAnalysis),
        ne(workspaces.id, excludeWorkspaceId),
      ),
    )
  } else {
    conditions.push(
      and(
        or(
          eq(workspaces.companyWebsite, normalizedUrl),
          sql`LOWER(${workspaces.companyWebsite}) LIKE ${`%${domainOnly}%`}`,
        ),
        isNotNull(workspaces.websiteAnalysis),
      ),
    )
  }

  const result = await db.select().from(workspaces).where(conditions[0]).limit(1)

  return result[0] || null
}

// Copy enrichment data and products from source workspace to target workspace
async function copyEnrichmentFromWorkspace(
  sourceWorkspaceId: string,
  targetWorkspaceId: string,
): Promise<void> {
  // Get source workspace
  const sourceWorkspace = await getWorkspaceOnlyById(sourceWorkspaceId)
  if (!sourceWorkspace) {
    throw new Error("Source workspace not found")
  }

  // Get target workspace to preserve some fields
  const targetWorkspace = await getWorkspaceOnlyById(targetWorkspaceId)
  if (!targetWorkspace) {
    throw new Error("Target workspace not found")
  }

  // Copy enrichment fields
  await updateWorkspace(targetWorkspaceId, {
    name: targetWorkspace.name,
    isActive: targetWorkspace.isActive,
    companyName: sourceWorkspace.companyName ?? undefined,
    industry: sourceWorkspace.industry ?? undefined,
    companySize: sourceWorkspace.companySize ?? undefined,
    companyDescription: sourceWorkspace.companyDescription ?? undefined,
    websiteAnalysis: sourceWorkspace.websiteAnalysis ?? undefined,
    targetAudiences: (sourceWorkspace.targetAudiences as string[] | null) ?? undefined,
    expansionGoals: (sourceWorkspace.expansionGoals as string[] | null) ?? undefined,
    competitiveAdvantages: (sourceWorkspace.competitiveAdvantages as string[] | null) ?? undefined,
    rawResearchOutput: sourceWorkspace.rawResearchOutput ?? undefined,
  })

  // Delete existing products from target
  await deleteWorkspaceProducts(targetWorkspaceId)

  // Get source products
  const sourceProducts = await listWorkspaceProducts(sourceWorkspaceId)

  // Copy products to target
  await Promise.all(
    sourceProducts.map((product) =>
      createWorkspaceProduct({
        workspaceId: targetWorkspaceId,
        name: product.name ?? undefined,
        description: product.description ?? undefined,
        category: product.category ?? undefined,
        features: (product.features as string[] | null) ?? undefined,
        priceRange: product.priceRange ?? undefined,
        targetAudience: product.targetAudience ?? undefined,
        imageUrl: product.imageUrl ?? undefined,
      }),
    ),
  )

  logger.info(
    {
      sourceWorkspaceId,
      targetWorkspaceId,
      productsCopied: sourceProducts.length,
    },
    "✅ [ENRICHMENT-CACHE] Copied enrichment data and products from cached workspace",
  )
}

// Build OnboardingEnrichmentOutput from workspace data (for cached enrichment)
function buildEnrichmentOutputFromWorkspace(
  workspace: NonNullable<Awaited<ReturnType<typeof getWorkspaceOnlyById>>>,
): OnboardingEnrichmentOutput {
  const websiteAnalysis = workspace.websiteAnalysis as {
    company: {
      name: string
      description: string
      industries: string[]
      size: string
      location: string
      foundedYear: string
      website: string
      logo: string
    }
    products: Array<{
      name: string
      description: string
      category: string
      features: string[]
      priceRange: string
      targetAudience: string
      image: string
    }>
  } | null

  return {
    companyAndProducts: websiteAnalysis || {
      company: {
        name: workspace.companyName || "",
        description: workspace.companyDescription || "",
        industries: workspace.industry ? [workspace.industry] : [],
        size: workspace.companySize || "",
        location: "",
        foundedYear: "",
        website: workspace.companyWebsite || "",
        logo: "",
      },
      products: [],
    },
    business: {
      business: {
        targetMarkets: (workspace.targetAudiences as string[]) || [],
        expansionGoals: (workspace.expansionGoals as string[]) || [],
        keywords: [],
        competitiveAdvantages: (workspace.competitiveAdvantages as string[]) || [],
      },
    },
    rawOutput: (workspace.rawResearchOutput as string) || "",
  }
}

export async function onboardingEnrichment({
  workspaceId,
  websiteUrl,
}: {
  workspaceId: string
  websiteUrl: string
}) {
  // Normalize the URL
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl)

  // Check for cached enrichment from another workspace
  const cachedWorkspace = await findWorkspaceByWebsite(normalizedUrl, workspaceId)

  if (cachedWorkspace) {
    logger.info(
      { workspaceId, cachedWorkspaceId: cachedWorkspace.id, websiteUrl: normalizedUrl },
      "🔄 [ONBOARDING-ENRICHMENT] Found cached enrichment, copying data",
    )

    await copyEnrichmentFromWorkspace(cachedWorkspace.id, workspaceId)

    logger.info(
      { workspaceId, cachedWorkspaceId: cachedWorkspace.id },
      "✅ [ONBOARDING-ENRICHMENT] Copied enrichment data from cached workspace",
    )
    return
  }

  // No cache found, proceed with normal workflow
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
    rawResearchOutput: { content: result.rawOutput },
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
      rawResearchOutput: { content: result.rawOutput },
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

    // Normalize the URL
    const normalizedUrl = normalizeWebsiteUrl(websiteUrl)

    // Check for cached enrichment from another workspace
    const cachedWorkspace = await findWorkspaceByWebsite(normalizedUrl, workspaceId)

    if (cachedWorkspace) {
      logger.info(
        { workspaceId, cachedWorkspaceId: cachedWorkspace.id },
        "🔄 [ENRICH-STREAM] Found cached enrichment",
      )

      // Emit progress events for cached path
      onProgress("researching", "Loading cached company research...")
      onProgress("extracting_company", "Loading cached company data...")
      onProgress("extracting_market", "Loading cached market analysis...")
      onProgress("saving", "Copying enrichment data...")

      await copyEnrichmentFromWorkspace(cachedWorkspace.id, workspaceId)

      // Generate strategies
      onProgress("strategizing", "Generating sales strategies...")

      // Build enrichment output from cached workspace
      const enrichmentOutput = buildEnrichmentOutputFromWorkspace(cachedWorkspace)
      const strategies = await generateStrategiesFromEnrichment(workspaceId, enrichmentOutput)

      onStrategies(strategies)

      logger.info(
        { workspaceId, cachedWorkspaceId: cachedWorkspace.id, strategiesCount: strategies.length },
        "✅ [ENRICH-STREAM] Completed with cached enrichment data",
      )

      onDone({ enrichment: enrichmentOutput, strategies })
      return
    }

    // No cache found, proceed with normal workflow
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
      rawResearchOutput: { content: result.rawOutput },
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

    // Generate strategies from enrichment data or fetch from linked sales strategy
    const strategies = await generateStrategiesFromEnrichment(workspaceId, result)

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

// Generate sales strategies from enrichment data or fetch from linked sales strategy
async function generateStrategiesFromEnrichment(
  workspaceId: string,
  enrichment: OnboardingEnrichmentOutput,
): Promise<SalesStrategy[]> {
  // First, check if there's a linked sales strategy with strategies data
  try {
    const linkedStrategies = await salesStrategyService.getWorkspaceSalesStrategies(workspaceId)

    if (linkedStrategies.length > 0) {
      // Check the first linked strategy for strategies field
      const linkedSalesStrategy = linkedStrategies[0]?.salesStrategy
      if (
        linkedSalesStrategy?.strategies &&
        Array.isArray(linkedSalesStrategy.strategies) &&
        linkedSalesStrategy.strategies.length > 0
      ) {
        // TODO: Return linked sales strategy data when DB field mapping is ready
        // The strategies field structure needs to match SalesStrategy[] interface
        logger.info(
          { workspaceId, strategiesCount: linkedSalesStrategy.strategies.length },
          "Found linked sales strategy with data, but returning dummy data for now (DB field mapping not ready)",
        )
      }
    }
  } catch (error) {
    logger.error(
      { error, workspaceId },
      "Error fetching linked sales strategies, falling back to generated data",
    )
  }

  // No linked strategy with data found, generate dummy data
  logger.info(
    { workspaceId },
    "No linked sales strategy with data found, generating strategies from enrichment",
  )

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
export async function deleteWorkspace(id: string, options?: { forceDelete?: boolean }) {
  const forceDelete = options?.forceDelete ?? false
  logger.info({ workspaceId: id, forceDelete }, "Starting workspace deletion")

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
    if (forceDelete) {
      // 강제 삭제 모드: 이메일과 답장을 먼저 삭제
      logger.warn(
        { workspaceId: id, emailCount: totalEmails },
        "Force deleting workspace with emails",
      )
      await db.delete(emailReplies).where(eq(emailReplies.workspaceId, id))
      await db.delete(emails).where(eq(emails.workspaceId, id))
      logger.info(
        { workspaceId: id, deletedEmails: totalEmails },
        "Deleted emails and replies for workspace",
      )
    } else {
      // 일반 삭제 모드: 이메일이 있으면 에러
      logger.warn(
        { workspaceId: id, emailCount: totalEmails },
        "Cannot delete workspace: emails exist",
      )
      throw new Error(
        `워크스페이스에 ${totalEmails}개의 이메일 또는 답장이 있습니다. 워크스페이스를 삭제하려면 먼저 이메일을 이동하거나 삭제해야 합니다.`,
      )
    }
  }

  // 2. このワークスペースのすべてのuser_email_accountsを取得（Nylas取り消し用のapiKeyを含む）
  const emailAccounts = await db
    .select({ id: userEmailAccounts.id, apiKey: userEmailAccounts.apiKey })
    .from(userEmailAccounts)
    .where(eq(userEmailAccounts.workspaceId, id))

  logger.info(
    { workspaceId: id, emailAccountCount: emailAccounts.length },
    "ワークスペースのメールアカウントを検出しました",
  )

  // 3. このワークスペースのすべてのメールアカウントのNylasグラントを取り消し
  let nylasGrantsDeleted = 0
  let nylasGrantsFailed = 0
  let sendGridAccountsSkipped = 0

  for (const account of emailAccounts) {
    // NylasのgrantIdの場合のみ取り消し（"SG"で始まるSendGrid APIキーは除外）
    if (account.apiKey && !account.apiKey.startsWith("SG")) {
      try {
        await deleteGrant(account.apiKey)
        nylasGrantsDeleted++
        logger.info(
          { grantId: account.apiKey, workspaceId: id, emailAccountId: account.id },
          "Successfully deleted Nylas grant during workspace deletion",
        )
      } catch (error) {
        nylasGrantsFailed++
        // ログ出力のみで失敗させない - グラントが既に無効な可能性あり
        logger.warn(
          { err: error, grantId: account.apiKey, workspaceId: id, emailAccountId: account.id },
          "Failed to delete Nylas grant during workspace deletion (may be already deleted)",
        )
      }
    } else if (account.apiKey?.startsWith("SG")) {
      sendGridAccountsSkipped++
    }
  }

  logger.info(
    {
      workspaceId: id,
      totalEmailAccounts: emailAccounts.length,
      nylasGrantsDeleted,
      nylasGrantsFailed,
      sendGridAccountsSkipped,
    },
    "Completed Nylas grant deletion for workspace",
  )

  // 4. これらのメールアカウントを参照するsequence_enrollmentsを削除
  if (emailAccounts.length > 0) {
    const emailAccountIds = emailAccounts.map((acc) => acc.id)
    const enrollmentCondition = or(
      ...emailAccountIds.map((accId) => eq(sequenceEnrollments.userEmailAccountId, accId)),
    )
    if (enrollmentCondition) {
      await db.delete(sequenceEnrollments).where(enrollmentCondition)
      logger.info(
        { workspaceId: id, emailAccountIds },
        "メールアカウントのシーケンス登録を削除しました",
      )
    }
  }

  // 5. ワークスペースを削除（RESTRICT制約により削除前にメールがチェックされる）
  await db.delete(workspaces).where(eq(workspaces.id, id))
  logger.info({ workspaceId: id }, "Workspace deleted successfully")

  // 6. 삭제 후 검증: 남은 데이터가 있는지 확인
  await verifyWorkspaceDeletion(id)
}

/**
 * 워크스페이스 삭제 후 남은 데이터 검증
 * 찌꺼기 데이터가 남아있는지 확인
 */
async function verifyWorkspaceDeletion(workspaceId: string) {
  try {
    // 1. 워크스페이스 확인
    const [workspace] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))

    // 2. 이메일 계정 확인 (cascade로 삭제되어야 함)
    const remainingEmailAccounts = await db
      .select({ count: count() })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.workspaceId, workspaceId))

    // 3. 워크스페이스 멤버 확인 (cascade로 삭제되어야 함)
    const remainingMembers = await db
      .select({ count: count() })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId))

    // 4. 리드 확인 (cascade로 삭제되어야 함)
    const remainingLeads = await db
      .select({ count: count() })
      .from(leads)
      .where(eq(leads.workspaceId, workspaceId))

    // 5. 시퀀스 확인 (cascade로 삭제되어야 함)
    const remainingSequences = await db
      .select({ count: count() })
      .from(sequences)
      .where(eq(sequences.workspaceId, workspaceId))

    const workspaceExists = workspace !== undefined
    const emailAccountCount = Number(remainingEmailAccounts[0]?.count || 0)
    const memberCount = Number(remainingMembers[0]?.count || 0)
    const leadCount = Number(remainingLeads[0]?.count || 0)
    const sequenceCount = Number(remainingSequences[0]?.count || 0)

    const hasLeftoverData =
      workspaceExists ||
      emailAccountCount > 0 ||
      memberCount > 0 ||
      leadCount > 0 ||
      sequenceCount > 0

    if (hasLeftoverData) {
      logger.error(
        {
          workspaceId,
          workspaceExists,
          emailAccountCount,
          memberCount,
          leadCount,
          sequenceCount,
        },
        "⚠️ WARNING: Workspace deletion verification failed - leftover data detected!",
      )
    } else {
      logger.info(
        {
          workspaceId,
          workspaceExists: false,
          emailAccountCount,
          memberCount,
          leadCount,
          sequenceCount,
        },
        "✅ Workspace deletion verification passed - no leftover data",
      )
    }
  } catch (error) {
    logger.error({ err: error, workspaceId }, "Failed to verify workspace deletion")
  }
}

// ====================================
// WORKSPACE QUERY AND SEARCH OPERATIONS
// ====================================

// ListWorkspaces :many
// 소유자가 삭제된 워크스페이스는 제외 (users.isActive: true만)
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
    .where(eq(users.isActive, true))
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
    workspaceIds?: string[] // 특정 워크스페이스 ID만 조회 (권한 기반 필터링용)
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

  // 특정 워크스페이스 ID만 조회 (권한 기반 필터링)
  if (filters?.workspaceIds !== undefined) {
    if (filters.workspaceIds.length === 0) {
      // 빈 배열이면 결과 없음 반환
      return []
    }
    const workspaceCondition = or(...filters.workspaceIds.map((id) => eq(workspaces.id, id)))
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  // 소유자가 삭제된 워크스페이스는 항상 제외
  conditions.push(eq(users.isActive, true))

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
  workspaceIds?: string[] // 특정 워크스페이스 ID만 조회 (권한 기반 필터링용)
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

  // 특정 워크스페이스 ID만 조회 (권한 기반 필터링)
  if (filters?.workspaceIds !== undefined) {
    if (filters.workspaceIds.length === 0) {
      // 빈 배열이면 0 반환
      return 0
    }
    const workspaceCondition = or(...filters.workspaceIds.map((id) => eq(workspaces.id, id)))
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
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
  skipIamSync?: boolean // Skip IAM sync when called from createWorkspace (already handled)
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

  // Sync IAM role for the new member (unless skipped)
  if (newMember && !data.skipIamSync) {
    try {
      await syncMemberRoleToIamRole(newMember.id, data.workspaceId, newMember.role)
    } catch (error) {
      logger.warn({ error, memberId: newMember.id }, "Failed to sync IAM role for new member")
    }
  }

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

  // Sync IAM role when member role changes
  if (updatedMember) {
    try {
      await syncMemberRoleToIamRole(updatedMember.id, updatedMember.workspaceId, role)
    } catch (error) {
      logger.warn({ error, memberId }, "Failed to sync IAM role after member role update")
    }
  }

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

// ====================================
// USER PERMISSION HELPERS
// ====================================

/**
 * 사용자가 관리자(admin)인지 확인
 * users 테이블의 userRole이 'admin'이거나 isSuperAdmin이 true인 경우 관리자로 판단
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const [user] = await db
    .select({
      userRole: users.userRole,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    return false
  }

  return user.userRole === "admin" || user.isSuperAdmin === true
}

/**
 * 사용자가 소유하거나 멤버로 속한 워크스페이스 ID 목록 반환
 */
export async function getUserWorkspaceIds(userId: string): Promise<string[]> {
  // 소유한 워크스페이스 ID
  const ownedWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))

  // 멤버로 속한 워크스페이스 ID (active 상태만)
  const memberWorkspaces = await db
    .select({ id: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.status, "active")))

  // 중복 제거하여 ID 목록 반환
  const workspaceIds = new Set<string>()

  for (const ws of ownedWorkspaces) {
    workspaceIds.add(ws.id)
  }

  for (const ws of memberWorkspaces) {
    workspaceIds.add(ws.id)
  }

  return Array.from(workspaceIds)
}
