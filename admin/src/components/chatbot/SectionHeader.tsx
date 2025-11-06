import type { ReactNode } from "react"

interface SectionHeaderProps {
  icon?: ReactNode
  title: string
  badge?: string
}

export function SectionHeader({ icon, title, badge }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      {badge && <span className="text-xs text-muted-foreground/60">{badge}</span>}
    </div>
  )
}
