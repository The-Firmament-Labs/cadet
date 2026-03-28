import { cn } from "@/lib/utils"

interface MetricHUDProps {
  value: string | number
  label: string
  code?: string | undefined
  variant?: "default" | "highlight" | undefined
}

export function MetricHUD({
  value,
  label,
  code,
  variant = "default",
}: MetricHUDProps) {
  return (
    <div
      className={cn(
        "py-8 px-6",
        variant === "highlight"
          ? "bg-primary text-primary-foreground"
          : "bg-background border-r border-border last:border-r-0"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-5xl font-bold tracking-tight">{String(value)}</span>
      </div>
      <div className="border-t border-current/20 pt-3">
        <p className="text-xs font-medium tracking-wider mb-1">{label}</p>
        {code && (
          <p className={cn(
            "font-mono text-xs",
            variant === "highlight" ? "text-primary-foreground/80" : "text-muted-foreground"
          )}>
            {code}
          </p>
        )}
      </div>
    </div>
  )
}
