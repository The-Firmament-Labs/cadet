import { Settings } from "lucide-react"

import { getSafeServerEnv } from "@/lib/env"
import { SettingsTabs } from "./settings-tabs"

export const dynamic = "force-dynamic"

const API_ENDPOINTS = [
  { method: "POST", path: "/api/agents/register",      description: "Register an agent manifest in SpacetimeDB" },
  { method: "POST", path: "/api/jobs/dispatch",         description: "Dispatch a new workflow job" },
  { method: "POST", path: "/api/jobs/dispatch/edge",    description: "Dispatch a job to an edge agent" },
  { method: "POST", path: "/api/approvals/[id]/resolve",description: "Approve or reject an approval gate" },
  { method: "POST", path: "/api/ingest/slack",          description: "Ingest a Slack event and seed a workflow" },
  { method: "POST", path: "/api/ingest/github",         description: "Ingest a GitHub event and seed a workflow" },
  { method: "POST", path: "/api/cron/reconcile",        description: "Cron: reconcile cloud control plane schedules" },
  { method: "GET",  path: "/api/health",                description: "Health check — returns 200 OK" },
  { method: "GET",  path: "/api/stream",                description: "Server-Sent Events live update stream" },
] as const

export default async function SettingsPage() {
  let env: ReturnType<typeof getSafeServerEnv> | null = null
  try {
    env = getSafeServerEnv()
  } catch {
    // env read failure — show placeholders
  }

  const controlPlane = [
    {
      label: "SpacetimeDB URL",
      value: env?.spacetimeUrl ?? "—",
      mono: true,
    },
    {
      label: "Database",
      value: env?.database ?? "—",
      mono: true,
    },
    {
      label: "Control Plane URL",
      value: env?.controlPlaneUrl ?? "—",
      mono: true,
    },
    {
      label: "Auth Token",
      value: env?.hasAuthToken ? "Configured" : "Not set",
      mono: false,
    },
    {
      label: "Cron Secret",
      value: env?.hasCronSecret ? "Configured" : "Not set",
      mono: false,
    },
    {
      label: "SpacetimeDB Config",
      value: env?.hasSpacetimeConfig ? "Present" : "Missing",
      mono: false,
    },
    {
      label: "Operator Auth",
      value: env?.hasOperatorAuth ? "Enabled" : "Disabled",
      mono: false,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings size={18} className="text-primary" />
        <h1 className="text-sm font-semibold tracking-wide">Settings</h1>
      </div>

      <SettingsTabs
        controlPlane={controlPlane}
        apiEndpoints={API_ENDPOINTS as unknown as Array<{ method: string; path: string; description: string }>}
      />
    </div>
  )
}
