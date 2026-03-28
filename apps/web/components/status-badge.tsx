import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusColors: Record<string, string> = {
  running:            "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  completed:          "border-green-500/30 bg-green-500/10 text-green-400",
  failed:             "border-destructive/30 bg-destructive/10 text-destructive",
  blocked:            "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  queued:             "border-border bg-secondary text-muted-foreground",
  pending:            "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
  "awaiting-approval": "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
}

export function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] ?? statusColors.queued
  return (
    <Badge
      variant="outline"
      className={cn("font-mono text-[10px] uppercase tracking-wider", colors)}
    >
      {status}
    </Badge>
  )
}
