import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type UserTier = "trial" | "basic" | "pro" | "enterprise" | "admin"

type UserTierBadgeProps = {
  tier: UserTier
  className?: string
  size?: "sm" | "default"
}

const TIER_STYLES: Record<UserTier, string> = {
  trial: "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200",
  basic: "bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-200",
  pro: "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200",
  enterprise: "bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200",
  admin: "bg-red-100 text-red-700 hover:bg-red-100 border-red-200",
}

export function UserTierBadge({ tier, className, size = "default" }: UserTierBadgeProps) {
  const { t } = useTranslation()

  const tierLabels: Record<UserTier, string> = {
    trial: t("tier.trial"),
    basic: t("tier.basic"),
    pro: t("tier.pro"),
    enterprise: t("tier.enterprise"),
    admin: t("tier.admin"),
  }

  return (
    <Badge
      className={cn(
        "shrink-0 border font-medium",
        TIER_STYLES[tier],
        size === "sm" && "px-2 py-0.5 text-[11px]",
        className,
      )}
      variant="secondary"
    >
      {tierLabels[tier]}
    </Badge>
  )
}

/**
 * 사용자 정보에서 표시할 티어를 결정합니다.
 * Admin 권한이 있으면 "admin", 아니면 trialStatus 또는 subscriptionTier 기반
 */
export function getUserDisplayTier(user: {
  userRole?: string
  trialStatus?: { isTrialActive: boolean }
  subscriptionTier?: string
}): UserTier | null {
  // Admin 권한이 있는 경우
  if (user.userRole === "admin") {
    return "admin"
  }

  // Trial 상태인 경우
  if (user.trialStatus?.isTrialActive) {
    return "trial"
  }

  // Subscription tier가 있는 경우
  if (user.subscriptionTier) {
    const tier = user.subscriptionTier.toLowerCase()
    if (tier === "basic" || tier === "pro" || tier === "enterprise") {
      return tier as UserTier
    }
  }

  return null
}
