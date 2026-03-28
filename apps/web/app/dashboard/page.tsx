import Link from "next/link"
import { loadInbox } from "@/lib/server"
import { LiveMetrics } from "./live-metrics"
import { StatusBadge } from "@/components/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function DashboardPage() {
  let inbox: Awaited<ReturnType<typeof loadInbox>> | null = null

  try {
    inbox = await loadInbox()
  } catch {
    // Control plane may not be reachable in dev; render empty state
    inbox = { threads: [], runs: [], approvals: [], browserTasks: [] }
  }

  const { runs, approvals, threads, browserTasks } = inbox

  const activeRuns = runs.filter((r) => r.status === "running").length
  const pendingApprovals = approvals.filter((a) => a.status === "pending").length
  const connectedAgents = threads.length // placeholder until presence data is available
  const browserTaskCount = browserTasks.length

  const recentRuns = runs.slice(0, 20)
  const pendingApprovalList = approvals.filter((a) => a.status === "pending").slice(0, 10)

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Stats strip — live-updating client component with SSR initial values */}
      <LiveMetrics
        initialMissions={runs.length}
        initialActiveOrbits={activeRuns}
        initialSignals={connectedAgents}
        initialPending={pendingApprovals}
      />

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent runs — col-span-2 */}
        <div className="lg:col-span-2">
          <Card className="border-secondary bg-secondary text-secondary-foreground">
            <CardHeader className="px-4 py-3 border-b border-secondary-foreground/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-secondary-foreground/50">
                  Recent Runs
                </h2>
                <Link
                  href="/dashboard/runs"
                  className="text-[11px] text-primary hover:underline font-mono"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentRuns.length === 0 ? (
                <p className="text-xs text-secondary-foreground/50 px-4 py-6 text-center">
                  No runs yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-secondary-foreground/10 hover:bg-transparent">
                      <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50 font-medium px-4 h-8">
                        Agent
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50 font-medium px-4 h-8">
                        Goal
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50 font-medium px-4 h-8">
                        Stage
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50 font-medium px-4 h-8">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentRuns.map((run) => (
                      <TableRow
                        key={run.runId}
                        className="border-secondary-foreground/10 hover:bg-secondary-foreground/5 transition-colors"
                      >
                        <TableCell className="px-4 py-2">
                          <Link
                            href={`/dashboard/runs/${run.runId}`}
                            className="text-xs font-mono text-secondary-foreground/50 hover:text-primary transition-colors truncate max-w-[120px] block"
                          >
                            {run.agentId}
                          </Link>
                        </TableCell>
                        <TableCell className="px-4 py-2 max-w-[260px]">
                          <span className="text-xs text-secondary-foreground truncate block">
                            {run.goal}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          <span className="text-[11px] font-mono text-secondary-foreground/50">
                            {run.currentStage}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          <StatusBadge status={run.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Approval queue */}
        <div className="lg:col-span-1">
          <Card className="border-secondary bg-secondary text-secondary-foreground">
            <CardHeader className="px-4 py-3 border-b border-secondary-foreground/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-secondary-foreground/50">
                  Approvals
                </h2>
                <Link
                  href="/dashboard/approvals"
                  className="text-[11px] text-primary hover:underline font-mono"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pendingApprovalList.length === 0 ? (
                <p className="text-xs text-secondary-foreground/50 px-4 py-6 text-center">
                  No pending approvals
                </p>
              ) : (
                <ul className="divide-y divide-secondary-foreground/10">
                  {pendingApprovalList.map((approval) => (
                    <li key={approval.approvalId} className="px-4 py-3 flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs text-secondary-foreground font-medium leading-snug flex-1 truncate">
                          {approval.title}
                        </span>
                        <StatusBadge status={approval.status} />
                      </div>
                      <span className="text-[11px] text-secondary-foreground/50 font-mono truncate">
                        {approval.agentId}
                      </span>
                      <div className="flex gap-2 mt-0.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] border-green-500/30 text-green-400 hover:bg-green-500/10"
                          asChild
                        >
                          <Link href={`/dashboard/approvals`}>Approve</Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] border-destructive/30 text-destructive hover:bg-destructive/10"
                          asChild
                        >
                          <Link href={`/dashboard/approvals`}>Reject</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
