import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "../db/index"
import {
  type NewSalesStrategy,
  salesStrategiesTable,
  workspaceSalesStrategies,
} from "../db/schema/sales-strategies"

// ====================================
// SALES STRATEGY CRUD OPERATIONS
// ====================================

// Get sales strategy by ID
export async function getSalesStrategy(id: string) {
  const result = await db
    .select()
    .from(salesStrategiesTable)
    .where(eq(salesStrategiesTable.id, id))
    .limit(1)

  return result[0]
}

// Create new sales strategy
export async function createSalesStrategy(data: NewSalesStrategy) {
  const [newStrategy] = await db
    .insert(salesStrategiesTable)
    .values({
      industry: data.industry,
      target: data.target,
      country: data.country,
      experience: data.experience,
      rindaSolution: data.rindaSolution,
      strategies: data.strategies,
      proofPoints: data.proofPoints,
      emailBenchmarks: data.emailBenchmarks,
    })
    .returning()

  return newStrategy
}

// Update sales strategy
export async function updateSalesStrategy(
  id: string,
  data: Partial<Omit<NewSalesStrategy, "id" | "createdAt">>,
) {
  const [updated] = await db
    .update(salesStrategiesTable)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(salesStrategiesTable.id, id))
    .returning()

  return updated
}

// Delete sales strategy
export async function deleteSalesStrategy(id: string) {
  await db.delete(salesStrategiesTable).where(eq(salesStrategiesTable.id, id))
}

// List sales strategies with pagination
export async function listSalesStrategies(limit: number, offset: number) {
  return db
    .select()
    .from(salesStrategiesTable)
    .orderBy(desc(salesStrategiesTable.createdAt))
    .limit(limit)
    .offset(offset)
}

// Count total sales strategies
export async function countSalesStrategies() {
  const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(salesStrategiesTable)

  return result?.count ?? 0
}

// ====================================
// WORKSPACE SALES STRATEGY OPERATIONS
// ====================================

// Get workspace sales strategies with strategy details
export async function getWorkspaceSalesStrategies(workspaceId: string) {
  return db
    .select({
      id: workspaceSalesStrategies.id,
      workspaceId: workspaceSalesStrategies.workspaceId,
      salesStrategyId: workspaceSalesStrategies.salesStrategyId,
      createdAt: workspaceSalesStrategies.createdAt,
      salesStrategy: salesStrategiesTable,
    })
    .from(workspaceSalesStrategies)
    .innerJoin(
      salesStrategiesTable,
      eq(workspaceSalesStrategies.salesStrategyId, salesStrategiesTable.id),
    )
    .where(eq(workspaceSalesStrategies.workspaceId, workspaceId))
    .orderBy(desc(workspaceSalesStrategies.createdAt))
}

// Link workspace to sales strategy
export async function linkWorkspaceToSalesStrategy(workspaceId: string, salesStrategyId: string) {
  const [link] = await db
    .insert(workspaceSalesStrategies)
    .values({
      workspaceId,
      salesStrategyId,
    })
    .returning()

  return link
}

// Unlink workspace from sales strategy
export async function unlinkWorkspaceFromSalesStrategy(id: string) {
  await db.delete(workspaceSalesStrategies).where(eq(workspaceSalesStrategies.id, id))
}

// Find sales strategy by input fields and link to workspace
export async function findAndLinkSalesStrategy(
  workspaceId: string,
  filters: {
    industry: (typeof salesStrategiesTable.industry.enumValues)[number]
    target: (typeof salesStrategiesTable.target.enumValues)[number]
    country: (typeof salesStrategiesTable.country.enumValues)[number]
    experience: (typeof salesStrategiesTable.experience.enumValues)[number]
  },
) {
  // Find existing sales strategy matching all 4 fields
  const [existingStrategy] = await db
    .select()
    .from(salesStrategiesTable)
    .where(
      and(
        eq(salesStrategiesTable.industry, filters.industry),
        eq(salesStrategiesTable.target, filters.target),
        eq(salesStrategiesTable.country, filters.country),
        eq(salesStrategiesTable.experience, filters.experience),
      ),
    )
    .limit(1)

  if (!existingStrategy) {
    return null
  }

  // Create the link
  const [link] = await db
    .insert(workspaceSalesStrategies)
    .values({
      workspaceId,
      salesStrategyId: existingStrategy.id,
    })
    .returning()

  return {
    salesStrategy: existingStrategy,
    link,
  }
}

// Find existing sales strategy or create new one, then link to workspace
export async function findOrCreateAndLinkSalesStrategy(
  workspaceId: string,
  filters: {
    industry: (typeof salesStrategiesTable.industry.enumValues)[number]
    target: (typeof salesStrategiesTable.target.enumValues)[number]
    country: (typeof salesStrategiesTable.country.enumValues)[number]
    experience: (typeof salesStrategiesTable.experience.enumValues)[number]
  },
) {
  return db.transaction(async (tx) => {
    // First, try to find existing sales strategy matching all 4 fields
    const [existingStrategy] = await tx
      .select()
      .from(salesStrategiesTable)
      .where(
        and(
          eq(salesStrategiesTable.industry, filters.industry),
          eq(salesStrategiesTable.target, filters.target),
          eq(salesStrategiesTable.country, filters.country),
          eq(salesStrategiesTable.experience, filters.experience),
        ),
      )
      .limit(1)

    let salesStrategy = existingStrategy

    // If no existing strategy found, create a new one
    if (!salesStrategy) {
      const [newStrategy] = await tx
        .insert(salesStrategiesTable)
        .values({
          industry: filters.industry,
          target: filters.target,
          country: filters.country,
          experience: filters.experience,
        })
        .returning()

      if (!newStrategy) {
        throw new Error("Failed to create sales strategy")
      }
      salesStrategy = newStrategy
    }

    // Link to workspace
    const [link] = await tx
      .insert(workspaceSalesStrategies)
      .values({
        workspaceId,
        salesStrategyId: salesStrategy.id,
      })
      .returning()

    return {
      salesStrategy,
      link,
      wasCreated: !existingStrategy,
    }
  })
}

// Create sales strategy and link to workspace in one transaction
export async function createAndLinkSalesStrategy(
  workspaceId: string,
  strategyData: NewSalesStrategy,
) {
  return db.transaction(async (tx) => {
    // Create the sales strategy
    const [newStrategy] = await tx
      .insert(salesStrategiesTable)
      .values({
        industry: strategyData.industry,
        target: strategyData.target,
        country: strategyData.country,
        experience: strategyData.experience,
        rindaSolution: strategyData.rindaSolution,
        strategies: strategyData.strategies,
        proofPoints: strategyData.proofPoints,
        emailBenchmarks: strategyData.emailBenchmarks,
      })
      .returning()

    if (!newStrategy) {
      throw new Error("Failed to create sales strategy")
    }

    // Link to workspace
    const [link] = await tx
      .insert(workspaceSalesStrategies)
      .values({
        workspaceId,
        salesStrategyId: newStrategy.id,
      })
      .returning()

    return {
      salesStrategy: newStrategy,
      link,
    }
  })
}
