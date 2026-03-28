import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface StatsCardProps {
  value: string
  superscript?: string
  label: string
  sublabel: string
  icon: ReactNode
  variant?: "default" | "highlight"
}

export function StatsCard({ 
  value, 
  superscript, 
  label, 
  sublabel, 
  icon,
  variant = "default" 
}: StatsCardProps) {
  return (
    <div 
      className={cn(
        "py-8 px-6",
        variant === "highlight" 
          ? "bg-primary text-primary-foreground" 
          : "bg-background"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold tracking-tight">{value}</span>
          {superscript && (
            <span className="text-lg font-medium">{superscript}</span>
          )}
        </div>
        <div className={cn(
          variant === "highlight" ? "text-primary-foreground" : "text-muted-foreground"
        )}>
          {icon}
        </div>
      </div>
      <div className="border-t border-current/20 pt-3">
        <p className="text-xs font-medium tracking-wider mb-1">{label}</p>
        <p className={cn(
          "font-mono text-xs",
          variant === "highlight" ? "text-primary-foreground/80" : "text-muted-foreground"
        )}>
          {sublabel}
        </p>
      </div>
    </div>
  )
}
