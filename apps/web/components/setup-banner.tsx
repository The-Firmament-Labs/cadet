"use client"

import { useState } from "react"
import { Check, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SetupStep {
  id: string
  label: string
  complete: boolean
  action?: string
  actionLabel?: string
}

interface SetupBannerProps {
  steps: SetupStep[]
  onLaunch?: () => void
}

export function SetupBanner({ steps, onLaunch }: SetupBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const completedCount = steps.filter((s) => s.complete).length
  const allComplete = completedCount === steps.length

  if (allComplete) return null

  return (
    <div className="relative border border-border rounded-lg px-4 py-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDismissed(true)}
        className="absolute top-1 right-1 h-6 w-6 p-0 text-muted-foreground"
      >
        <X size={14} />
      </Button>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Getting Started</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {completedCount}/{steps.length}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-2">
              {i > 0 && (
                <ChevronRight size={10} className="text-secondary-foreground/20" />
              )}
              <div className="flex items-center gap-1.5">
                {step.complete ? (
                  <span className="w-4 h-4 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Check size={10} className="text-primary" />
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full border border-border" />
                )}
                {!step.complete && step.action ? (
                  <a
                    href={step.action}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {step.actionLabel ?? step.label}
                  </a>
                ) : !step.complete && step.actionLabel && step.id === "agent" ? (
                  <Button variant="link" size="sm" onClick={onLaunch} className="h-auto p-0 text-xs">
                    {step.actionLabel}
                  </Button>
                ) : (
                  <span className={`text-xs ${step.complete ? "text-muted-foreground" : "text-foreground/70"}`}>
                    {step.label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
