"use client"

import { useState } from "react"
import { Check, ChevronRight, X } from "lucide-react"

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
    <div className="relative border border-primary/20 bg-primary/5 rounded-lg px-4 py-3">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 text-secondary-foreground/30 hover:text-secondary-foreground/60 transition-colors"
      >
        <X size={14} />
      </button>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-primary">Getting Started</span>
          <span className="text-[10px] text-secondary-foreground/50 font-mono">
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
                  <span className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <Check size={10} className="text-green-400" />
                  </span>
                ) : (
                  <span className="w-4 h-4 rounded-full border border-secondary-foreground/20" />
                )}
                {!step.complete && step.action ? (
                  <a
                    href={step.action}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {step.actionLabel ?? step.label}
                  </a>
                ) : !step.complete && step.actionLabel && step.id === "agent" ? (
                  <button
                    onClick={onLaunch}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {step.actionLabel}
                  </button>
                ) : (
                  <span className={`text-xs ${step.complete ? "text-secondary-foreground/50" : "text-secondary-foreground/70"}`}>
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
