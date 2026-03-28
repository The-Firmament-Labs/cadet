import { Bot } from "lucide-react"

import { createControlClient } from "@/lib/server"
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

interface AgentRecord {
  agent_id: string
  display_name?: string | null
  runtime?: string | null
  execution_target?: string | null
  control_plane?: string | null
  tags?: string | null
  status?: string | null
}

export default async function AgentsPage() {
  let agents: AgentRecord[] = []
  let error: string | null = null

  try {
    const client = createControlClient()
    const rows = await client.sql("SELECT * FROM agent_record")
    agents = rows as AgentRecord[]
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load agents"
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bot size={18} className="text-primary" />
        <h1 className="text-sm font-semibold tracking-wide">Agent Roster</h1>
      </div>

      <Card className="bg-secondary text-secondary-foreground border-secondary">
        <CardHeader className="border-b border-secondary-foreground/10 pb-3">
          <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
            Registered Agents
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-destructive font-mono">{error}</p>
              <p className="text-xs text-secondary-foreground/50 mt-1">
                Confirm SpacetimeDB is reachable.
              </p>
            </div>
          ) : agents.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-secondary-foreground/50">No agents registered yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-secondary-foreground/10">
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Agent ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Display Name</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Runtime</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Execution Target</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Control Plane</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Tags</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.agent_id} className="border-secondary-foreground/10">
                    <TableCell className="font-mono text-xs text-secondary-foreground/50">
                      {agent.agent_id}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {agent.display_name ?? agent.agent_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-secondary-foreground/50">
                      {agent.runtime ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-secondary-foreground/50">
                      {agent.execution_target ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-secondary-foreground/50">
                      {agent.control_plane ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-secondary-foreground/50">
                      {agent.tags ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={agent.status ?? "unknown"} />
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
