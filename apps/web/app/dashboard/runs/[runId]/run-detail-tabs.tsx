"use client"

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

interface RunDetailTabsProps {
  steps: WorkflowStep[]
  browserArtifacts: BrowserArtifact[]
  approvals: ApprovalRequest[]
  toolCalls: ToolCall[]
}

function formatTs(micros: number): string {
  return new Date(micros / 1000).toLocaleTimeString()
}

function tryParseJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function RunDetailTabs({
  steps,
  browserArtifacts,
  approvals,
  toolCalls,
}: RunDetailTabsProps) {
  return (
    <Tabs defaultValue="timeline">
      <TabsList className="mb-4">
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="browser">Browser</TabsTrigger>
        <TabsTrigger value="approvals">Approvals</TabsTrigger>
        <TabsTrigger value="toolcalls">Tool Calls</TabsTrigger>
      </TabsList>

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
                      className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center"
                      style={{
                        backgroundColor:
                          step.status === "completed" || step.status === "succeeded"
                            ? "#4dff88"
                            : step.status === "running"
                            ? "#00e5ff"
                            : step.status === "failed"
                            ? "#ff4d4d"
                            : step.status === "blocked"
                            ? "#ffaa33"
                            : "rgba(220,228,255,0.3)",
                      }}
                    />
                    <div className="flex items-start gap-3 flex-wrap">
                      <span className="text-xs font-mono font-medium text-secondary-foreground">
                        {step.stage}
                      </span>
                      <StatusBadge status={step.status} />
                      <span className="text-[10px] text-secondary-foreground/50 font-mono ml-auto">
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
    </Tabs>
  )
}
