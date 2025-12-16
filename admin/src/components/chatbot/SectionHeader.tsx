import type { ReactNode } from "react"

type SectionHeaderProps = {
  icon?: ReactNode
  title: string
  badge?: string
}

export function SectionHeader({ icon, title, badge }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
        {title}
      </span>
      {badge && <span className="text-muted-foreground/60 text-xs">{badge}</span>}
    </div>
  )
}
