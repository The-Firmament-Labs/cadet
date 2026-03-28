import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function MetricHUD({
  label,
  value,
  variant,
  code,
}: {
  label: string
  value: number | string
  variant?: "coral" | "charcoal" | "sage" | undefined
  code?: string | undefined
}) {
  return (
    <Card
      className={cn(
        "rounded-sm",
        variant === "coral" && "bg-[#e07b5a] text-white border-[#e07b5a]",
        variant === "charcoal" && "bg-[#3a3a3a] text-[#e8e4df] border-[#3a3a3a]",
        variant === "sage" && "bg-[var(--card-light)] text-[#1a1a1a] border-transparent",
        !variant && "bg-[var(--card-light)] text-[#1a1a1a] border-transparent",
      )}
    >
      <CardContent className="p-5 flex flex-col justify-between min-h-[140px]">
        <div className="flex items-start justify-between">
          <p className="text-[48px] font-mono font-bold tracking-tighter leading-none">
            {String(value)}
          </p>
        </div>
        <div className="mt-auto pt-3 border-t border-current/10">
          <p className="text-xs uppercase tracking-[0.12em] font-bold">{label}</p>
          {code && (
            <p className="text-xs font-mono opacity-50 mt-0.5">{code}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
