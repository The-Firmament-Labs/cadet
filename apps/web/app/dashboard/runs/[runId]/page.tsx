import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { getOperatorSpacetimeToken, getOperatorSession } from "@/lib/auth"
import { loadRunDetails } from "@/lib/server"
import { StatusBadge } from "@/components/status-badge"
import { RunDetailTabs } from "./run-detail-tabs"

export const dynamic = "force-dynamic"

export default async function DashboardRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params
  const session = await getOperatorSession()
  const detail = await loadRunDetails(
    runId,
    getOperatorSpacetimeToken(session)
  ).catch(() => null)

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/runs"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={12} />
          Back to Runs
        </Link>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm font-medium">Run unavailable</p>
          <p className="text-xs text-muted-foreground text-center max-w-sm">
            The run could not be loaded. Confirm SpacetimeDB is reachable and the run still exists.
          </p>
          <p className="text-[10px] font-mono text-muted-foreground opacity-60">{runId}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/dashboard/runs"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={12} />
        Back to Runs
      </Link>

      {/* Run header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={detail.run.status} />
          <StatusBadge status={detail.run.currentStage} />
        </div>
        <h1 className="text-base font-medium leading-snug">{detail.run.goal}</h1>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <span>{detail.run.agentId}</span>
          <span className="opacity-40">·</span>
          <span className="opacity-60 truncate">{detail.run.runId}</span>
        </div>
      </div>

      {/* Tabbed detail */}
      <RunDetailTabs
        steps={detail.steps}
        browserArtifacts={detail.browserArtifacts}
        approvals={detail.approvals}
        toolCalls={detail.toolCalls}
      />
    </div>
  )
}
