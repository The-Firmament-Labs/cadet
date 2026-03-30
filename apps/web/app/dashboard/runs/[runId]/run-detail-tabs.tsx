"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/status-badge"

interface WorkflowStep {
  stepId: string
  stage: string
  status: string
  ownerExecution: string
  updatedAtMicros: number
}

interface BrowserArtifact {
  artifactId: string
  kind: string
  title: string
  url: string
  taskId: string
}

interface ApprovalRequest {
  approvalId: string
  title: string
  detail: string
  risk: string
  status: string
  agentId?: string
}

interface ToolCall {
  toolCallId: string
  toolName: string
  status: string
  inputJson: string
  outputJson?: string | null
}

interface MessageEvent {
  eventId: string
  direction: string
  actor: string
  content: string
  channel: string
  runId: string
  updatedAtMicros?: number
  [key: string]: unknown
}

interface RetrievalTrace {
  traceId: string
  query?: string
  sourceKind?: string
  chunkCount?: number
  updatedAtMicros?: number
  [key: string]: unknown
}

interface RunDetailTabsProps {
  steps: WorkflowStep[]
  browserArtifacts: BrowserArtifact[]
  approvals: ApprovalRequest[]
  toolCalls: ToolCall[]
  messages?: Array<Record<string, unknown>>
  retrievalTraces?: Array<Record<string, unknown>>
  runId?: string
}

import { microsAgo, microsToLocale } from "@/lib/format-time"

function formatTs(micros: number): string {
  return microsAgo(micros)
}

function fullTs(micros: number): string {
  return microsToLocale(micros)
}

function tryParseJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function RunDetailTabs({
  steps: initialSteps,
  browserArtifacts,
  approvals,
  toolCalls,
  messages = [],
  retrievalTraces = [],
  runId,
}: RunDetailTabsProps) {
  const [steps, setSteps] = useState(initialSteps)
  const [liveConnected, setLiveConnected] = useState(false)

  // SSE live updates for step progress
  useEffect(() => {
    if (!runId) return

    const es = new EventSource("/api/stream")
    setLiveConnected(true)

    es.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data?.steps) {
          const runSteps = data.steps.filter(
            (s: WorkflowStep) => s.stepId?.startsWith(`route_`) || s.stepId?.includes(runId.replace("run_", ""))
          )
          if (runSteps.length > 0) {
            setSteps(runSteps)
          }
        }
      } catch {
        // Ignore parse errors
      }
    })

    es.onerror = () => {
      setLiveConnected(false)
    }

    return () => {
      es.close()
      setLiveConnected(false)
    }
  }, [runId])

  return (
    <Tabs defaultValue="timeline">
      <div className="flex items-center gap-2 mb-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="messages">Messages{messages.length > 0 ? ` (${messages.length})` : ""}</TabsTrigger>
          <TabsTrigger value="browser">Browser</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="toolcalls">Tool Calls</TabsTrigger>
          <TabsTrigger value="retrieval">Retrieval{retrievalTraces.length > 0 ? ` (${retrievalTraces.length})` : ""}</TabsTrigger>
        </TabsList>
        {liveConnected && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold tracking-widest text-green-400 border border-green-500/30 bg-green-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Timeline */}
      <TabsContent value="timeline">
        <Card className="bg-secondary text-secondary-foreground border-secondary">
          <CardHeader className="border-b border-secondary-foreground/10 pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
              Workflow Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {steps.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-secondary-foreground/50">
                No steps recorded yet.
              </div>
            ) : (
              <ol className="relative border-l border-secondary-foreground/10 ml-6 my-4 space-y-4 pr-4">
                {steps.map((step) => (
                  <li key={step.stepId} className="relative pl-6">
                    <span
                      className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center ${
                        step.status === "completed" || step.status === "succeeded"
                          ? "bg-primary"
                          : step.status === "running"
                          ? "bg-ring"
                          : step.status === "failed"
                          ? "bg-destructive"
                          : step.status === "blocked"
                          ? "bg-accent"
                          : "bg-muted"
                      }`}
                    />
                    <div className="flex items-start gap-3 flex-wrap">
                      <span className="text-xs font-mono font-medium text-secondary-foreground">
                        {step.stage}
                      </span>
                      <StatusBadge status={step.status} />
                      <span className="text-[10px] text-secondary-foreground/50 font-mono ml-auto" title={fullTs(step.updatedAtMicros)}>
                        {formatTs(step.updatedAtMicros)}
                      </span>
                    </div>
                    <p className="text-[10px] text-secondary-foreground/50 font-mono mt-0.5">
                      {step.ownerExecution}
                    </p>
                    <p className="text-[10px] text-secondary-foreground/50 font-mono opacity-50 truncate">
                      {step.stepId}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Messages */}
      <TabsContent value="messages">
        <Card className="bg-secondary text-secondary-foreground border-secondary">
          <CardHeader className="border-b border-secondary-foreground/10 pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
              Conversation Thread
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {messages.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-secondary-foreground/50">
                No messages for this run.
              </div>
            ) : (
              <div className="divide-y divide-secondary-foreground/10">
                {messages.map((msg, i) => (
                  <div key={String(msg.eventId ?? i)} className="px-4 py-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={String(msg.direction ?? "unknown")} />
                      <span className="text-xs font-mono font-medium">{String(msg.actor ?? "")}</span>
                      {msg.updatedAtMicros ? (
                        <span className="text-[10px] text-secondary-foreground/50 font-mono ml-auto">
                          {formatTs(Number(msg.updatedAtMicros))}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-secondary-foreground/80 whitespace-pre-wrap">
                      {String(msg.content ?? "")}
                    </p>
                    <p className="text-[10px] font-mono text-secondary-foreground/50 opacity-50">
                      {String(msg.channel ?? "")} · {String(msg.eventId ?? "")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Browser */}
      <TabsContent value="browser">
        <Card className="bg-secondary text-secondary-foreground border-secondary">
          <CardHeader className="border-b border-secondary-foreground/10 pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
              Browser Artifacts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {browserArtifacts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-secondary-foreground/50">
                No browser artifacts recorded.
              </div>
            ) : (
              <div className="divide-y divide-secondary-foreground/10">
                {browserArtifacts.map((artifact) => (
                  <div key={artifact.artifactId} className="px-4 py-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={artifact.kind} />
                      <span className="text-xs font-medium">{artifact.title}</span>
                    </div>
                    {artifact.url ? (
                      <a
                        href={artifact.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-primary hover:underline truncate block"
                      >
                        {artifact.url}
                      </a>
                    ) : null}
                    <p className="text-[10px] font-mono text-secondary-foreground/50 opacity-50">
                      {artifact.artifactId}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Approvals */}
      <TabsContent value="approvals">
        <Card className="bg-secondary text-secondary-foreground border-secondary">
          <CardHeader className="border-b border-secondary-foreground/10 pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
              Approval Gates
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {approvals.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-secondary-foreground/50">
                No approvals for this run.
              </div>
            ) : (
              <div className="divide-y divide-secondary-foreground/10">
                {approvals.map((approval) => (
                  <div key={approval.approvalId} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">{approval.title}</span>
                      <StatusBadge status={approval.risk} />
                      <StatusBadge status={approval.status} />
                    </div>
                    <p className="text-xs text-secondary-foreground/50">{approval.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tool Calls */}
      <TabsContent value="toolcalls">
        <Card className="bg-secondary text-secondary-foreground border-secondary">
          <CardHeader className="border-b border-secondary-foreground/10 pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
              Tool Calls
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {toolCalls.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-secondary-foreground/50">
                No tool calls recorded yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-secondary-foreground/10">
                    <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Tool</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Status</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Input</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Output</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {toolCalls.map((tc) => (
                    <TableRow key={tc.toolCallId} className="border-secondary-foreground/10">
                      <TableCell className="font-mono text-xs font-medium">{tc.toolName}</TableCell>
                      <TableCell>
                        <StatusBadge status={tc.status} />
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <pre className="text-[9px] font-mono text-secondary-foreground/50 overflow-hidden truncate">
                          {tryParseJson(tc.inputJson)}
                        </pre>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <pre className="text-[9px] font-mono text-secondary-foreground/50 overflow-hidden truncate">
                          {tc.outputJson ? tryParseJson(tc.outputJson) : "—"}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Retrieval Traces */}
      <TabsContent value="retrieval">
        <Card className="bg-secondary text-secondary-foreground border-secondary">
          <CardHeader className="border-b border-secondary-foreground/10 pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
              Memory Retrieval
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {retrievalTraces.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-secondary-foreground/50">
                No retrieval traces for this run.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-secondary-foreground/10">
                    <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Query</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Source</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Chunks</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retrievalTraces.map((trace, i) => (
                    <TableRow key={String(trace.traceId ?? i)} className="border-secondary-foreground/10">
                      <TableCell className="text-xs max-w-[250px] truncate">{String(trace.query ?? "—")}</TableCell>
                      <TableCell>
                        <StatusBadge status={String(trace.sourceKind ?? "unknown")} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{String(trace.chunkCount ?? 0)}</TableCell>
                      <TableCell className="text-[10px] font-mono text-secondary-foreground/50">
                        {trace.updatedAtMicros ? formatTs(Number(trace.updatedAtMicros)) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
