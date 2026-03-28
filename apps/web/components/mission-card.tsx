import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface MissionCardProps {
  code: string
  title: string
  status: string
  category: string
  progress: number
  icon: ReactNode
  color: "primary" | "secondary" | "muted"
}

export function MissionCard({
  code,
  title,
  status,
  category,
  progress,
  icon,
  color
}: MissionCardProps) {
  const colorClasses = {
    primary: "bg-primary text-primary-foreground",
    secondary: "bg-foreground text-background",
    muted: "bg-muted text-foreground"
  }

  const progressBgClasses = {
    primary: "bg-primary-foreground/30",
    secondary: "bg-background/30",
    muted: "bg-foreground/20"
  }

  const progressFillClasses = {
    primary: "bg-primary-foreground",
    secondary: "bg-background",
    muted: "bg-foreground"
  }

  return (
    <div className={cn("p-6 flex flex-col min-h-[280px]", colorClasses[color])}>
      <div className="flex items-start justify-between mb-6">
        <span className="text-5xl font-bold tracking-tight opacity-80">{code}</span>
        <div className="opacity-60">{icon}</div>
      </div>
      
      <div className="mt-auto">
        <span className={cn(
          "inline-block px-2 py-0.5 text-[10px] font-mono tracking-wider mb-3",
          color === "primary" ? "bg-primary-foreground/20" : 
          color === "secondary" ? "bg-background/20" : "bg-foreground/10"
        )}>
          {status}
        </span>
        
        <h3 className="text-lg font-bold mb-1">{title}</h3>
        <p className={cn(
          "text-xs font-mono mb-4",
          color === "muted" ? "text-muted-foreground" : "opacity-70"
        )}>
          {category}
        </p>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span>PROGRESS</span>
            <span>{progress}%</span>
          </div>
          <div className={cn("h-1 rounded-full", progressBgClasses[color])}>
            <div 
              className={cn("h-full rounded-full transition-all", progressFillClasses[color])}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
