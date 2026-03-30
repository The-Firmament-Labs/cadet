"use client"

import { useState } from "react"
import { LaunchMissionDialog } from "@/components/launch-mission-dialog"
import { SetupBanner } from "@/components/setup-banner"

interface SetupStep {
  id: string
  label: string
  complete: boolean
  action?: string
  actionLabel?: string
}

interface AgentOption {
  id: string
  name: string
  runtime: string
  execution: string
  description: string
  hasSandbox: boolean
}

interface DashboardHeaderProps {
  agents: AgentOption[]
  setupSteps: SetupStep[]
}

export function DashboardHeader({ agents, setupSteps }: DashboardHeaderProps) {
  const [launchOpen, setLaunchOpen] = useState(false)

  const hasIncompleteSetup = setupSteps.some((s) => !s.complete)

  return (
    <div className="flex flex-col gap-4">
      {hasIncompleteSetup && (
        <SetupBanner
          steps={setupSteps}
          onLaunch={() => setLaunchOpen(true)}
        />
      )}
      <div className="flex items-center justify-end">
        <LaunchMissionDialog agents={agents} />
      </div>
    </div>
  )
}
