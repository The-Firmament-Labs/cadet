import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusColors: Record<string, string> = {
  running:             "border-[#e07b5a]/40 bg-[#e07b5a]/15 text-[#e07b5a]",
  active:              "border-[#e07b5a]/40 bg-[#e07b5a]/15 text-[#e07b5a]",
  completed:           "border-[#5a8a5a]/40 bg-[#5a8a5a]/15 text-[#5a8a5a]",
  failed:              "border-[#c94a4a]/40 bg-[#c94a4a]/15 text-[#c94a4a]",
  blocked:             "border-[#c98a3a]/40 bg-[#c98a3a]/15 text-[#c98a3a]",
  queued:              "border-[#1a1a1a]/20 bg-[#1a1a1a]/5 text-[#1a1a1a]/60",
  pending:             "border-[#c98a3a]/40 bg-[#c98a3a]/15 text-[#c98a3a]",
  "awaiting-approval": "border-[#c98a3a]/40 bg-[#c98a3a]/15 text-[#c98a3a]",
  "en-route":          "border-[#3a3a3a] bg-[#3a3a3a] text-[#e8e4df]",
  monitoring:          "border-[#1a1a1a]/20 bg-[#1a1a1a]/8 text-[#1a1a1a]/70",
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
