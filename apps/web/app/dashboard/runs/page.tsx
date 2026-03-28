import Link from "next/link"
import { Play } from "lucide-react"

import {
  getOperatorSpacetimeToken,
  getOperatorSession,
} from "@/lib/auth"
import { loadInbox } from "@/lib/server"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

export default async function RunsPage() {
  const session = await getOperatorSession()
  let runs: Awaited<ReturnType<typeof loadInbox>>["runs"] = []
  let error: string | null = null

  try {
    const inbox = await loadInbox(getOperatorSpacetimeToken(session))
    runs = inbox.runs
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load runs"
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Play size={18} className="text-primary" />
        <h1 className="text-sm font-semibold tracking-wide">Workflow Runs</h1>
      </div>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            All Runs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-destructive font-mono">{error}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Confirm SpacetimeDB is reachable.
              </p>
            </div>
          ) : runs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No workflow runs yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Start SpacetimeDB and the control planes to populate runs.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase tracking-widest">Agent</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest">Goal</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest">Stage</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest">Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.runId}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {run.agentId}
                    </TableCell>
                    <TableCell className="text-xs max-w-[320px]">
                      <Link
                        href={`/dashboard/runs/${run.runId}`}
                        className="hover:text-primary transition-colors truncate block"
                      >
                        {run.goal}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {run.currentStage}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {run.priority ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
