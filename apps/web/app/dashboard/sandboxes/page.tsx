import { Container } from "lucide-react"
import { getOperatorSession, getOperatorSpacetimeToken } from "@/lib/auth"
import { getSafeServerEnv } from "@/lib/env"
import { createControlClient } from "@/lib/server"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { SandboxActions } from "./sandbox-actions"

export const dynamic = "force-dynamic"

interface SandboxRow {
  sandbox_id: string
  operator_id: string
  agent_id: string
  status: string
  snapshot_id?: string
  created_at_micros: number
  updated_at_micros: number
}

export default async function SandboxesPage() {
  const env = getSafeServerEnv()
  const session = await getOperatorSession()
  let sandboxes: SandboxRow[] = []
  let error: string | null = null

  if (!env.appStoreSafeMode) {
    try {
      const client = createControlClient(getOperatorSpacetimeToken(session))
      sandboxes = (await client.sql(
        "SELECT sandbox_id, operator_id, agent_id, status, snapshot_id, created_at_micros, updated_at_micros FROM sandbox_instance ORDER BY updated_at_micros DESC"
      )) as SandboxRow[]
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load sandboxes"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Container size={18} className="text-primary" />
        <h1 className="text-sm font-semibold tracking-wide">Sandboxes</h1>
      </div>

      <Card className="bg-secondary text-secondary-foreground border-secondary">
        <CardHeader className="border-b border-secondary-foreground/10 pb-3">
          <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
            Vercel Sandbox Instances
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-destructive font-mono">{error}</p>
            </div>
          ) : env.appStoreSafeMode ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-secondary-foreground/50">
                Sandbox execution is disabled in <span className="font-mono">APP_STORE_SAFE_MODE</span>.
              </p>
            </div>
          ) : sandboxes.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-secondary-foreground/50">
                No sandboxes. Launch a coding agent to create one.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-secondary-foreground/10">
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Sandbox ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Agent</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Status</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Created</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sandboxes.map((sb) => (
                  <TableRow key={sb.sandbox_id} className="border-secondary-foreground/10">
                    <TableCell className="font-mono text-xs text-secondary-foreground/50 truncate max-w-[150px]">
                      {sb.sandbox_id}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{sb.agent_id}</TableCell>
                    <TableCell><StatusBadge status={sb.status} /></TableCell>
                    <TableCell className="text-[10px] font-mono text-secondary-foreground/50">
                      {new Date(sb.created_at_micros / 1000).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <SandboxActions sandboxId={sb.sandbox_id} status={sb.status} snapshotId={sb.snapshot_id} agentId={sb.agent_id} />
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
