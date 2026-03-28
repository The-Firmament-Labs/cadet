import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function MetricHUD({
  label,
  value,
  glow,
}: {
  label: string
  value: number | string
  glow?: "cyan" | "gold" | "green" | undefined
}) {
  return (
    <Card
      className={cn(
        "border-border bg-[var(--card)]",
        glow === "cyan" && "shadow-[var(--glow-primary)]",
        glow === "gold" && "shadow-[var(--glow-accent)]",
        glow === "green" && "shadow-[0_0_12px_rgba(77,255,136,0.15)]",
      )}
    >
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
          {label}
        </p>
        <p className="text-2xl font-mono font-bold tracking-tight mt-1">{String(value)}</p>
      </CardContent>
    </Card>
  )
}
