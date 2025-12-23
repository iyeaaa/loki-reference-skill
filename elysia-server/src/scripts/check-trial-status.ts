import { and, eq } from "drizzle-orm"
import { db } from "../db/index"
import { billingPlans, billingProducts, subscriptions } from "../db/schema/billing"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"

async function checkTrialStatus() {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.email, "iyeaaa@grinda.ai"))

  if (!user) {
    console.log("❌ User not found")
    process.exit(1)
  }

  console.log("\n👤 사용자:", user.email)

  // Get user's workspace
  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.ownerId, user.id))
    .limit(1)

  if (!workspace) {
    console.log("❌ No workspace found")
    process.exit(1)
  }

  console.log("🏢 워크스페이스:", workspace.name)

  // Get subscription
  const [subscription] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      trialStart: subscriptions.trialStart,
      trialEnd: subscriptions.trialEnd,
      tier: billingProducts.tier,
    })
    .from(subscriptions)
    .innerJoin(billingPlans, eq(subscriptions.planId, billingPlans.id))
    .innerJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
    .where(and(eq(subscriptions.workspaceId, workspace.id), eq(subscriptions.isPrimary, true)))
    .limit(1)

  if (!subscription) {
    console.log("❌ No subscription found")
    process.exit(1)
  }

  console.log("\n📊 구독 상태:")
  console.log(`  - subscriptions.status: ${subscription.status}`)
  console.log(`  - subscriptions.trial_start: ${subscription.trialStart}`)
  console.log(`  - subscriptions.trial_end: ${subscription.trialEnd}`)
  console.log(`  - tier: ${subscription.tier}`)

  const now = new Date()
  const isTrialActive = subscription.status === "trialing"
  const isExpired = subscription.trialEnd && now > subscription.trialEnd
  const daysRemaining = subscription.trialEnd
    ? Math.max(
        0,
        Math.ceil((subscription.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      )
    : 0

  console.log("\n✅ Trial 상태:")
  console.log(`  - Active: ${isTrialActive && !isExpired}`)
  console.log(`  - Expired: ${isExpired}`)
  console.log(`  - Days Remaining: ${daysRemaining}`)

  process.exit(0)
}

checkTrialStatus()
