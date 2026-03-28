import { Bot } from "lucide-react"

import { createControlClient } from "@/lib/server"
import { detectLocalControlPlane } from "@/lib/local-control"
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
  let localPlane: Awaited<ReturnType<typeof detectLocalControlPlane>> = {
    reachable: false,
    url: "http://localhost:3010",
  }

  // Run cloud query and local detection in parallel
  const [cloudResult, localResult] = await Promise.allSettled([
    (async () => {
      const client = createControlClient()
      return client.sql("SELECT * FROM agent_record")
    })(),
    detectLocalControlPlane(),
  ])

  if (cloudResult.status === "fulfilled") {
    agents = cloudResult.value as AgentRecord[]
  } else {
    error =
      cloudResult.reason instanceof Error
        ? cloudResult.reason.message
        : "Failed to load agents"
  }

  if (localResult.status === "fulfilled") {
    localPlane = localResult.value
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bot size={18} className="text-primary" />
        <h1 className="text-sm font-semibold tracking-wide">Agent Roster</h1>
      </div>

      {/* Local control plane section */}
      <Card className="bg-secondary text-secondary-foreground border-secondary">
        <CardHeader className="border-b border-secondary-foreground/10 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
              Local Control Plane
            </CardTitle>
            {localPlane.reachable ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-semibold tracking-widest text-green-400 border border-green-500/30 bg-green-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                CONNECTED
              </span>
            ) : (
              <span className="text-[10px] font-mono text-secondary-foreground/30 tracking-widest">
                LOCAL.OFFLINE
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {localPlane.reachable && localPlane.agents && localPlane.agents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-secondary-foreground/10">
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Agent ID</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Name</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localPlane.agents.map((agent) => (
                  <TableRow key={agent.id} className="border-secondary-foreground/10">
                    <TableCell className="font-mono text-xs text-secondary-foreground/50">
                      {agent.id}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {agent.name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={agent.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : localPlane.reachable ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-secondary-foreground/50">No local agents running.</p>
            </div>
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-secondary-foreground/30 font-mono">
                No local control plane detected at {localPlane.url}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cloud agents table */}
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
