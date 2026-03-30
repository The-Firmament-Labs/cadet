"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Rocket, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface AgentOption {
  id: string
  name: string
  runtime: string
  execution: string
  description: string
  hasSandbox: boolean
}

interface LaunchMissionDialogProps {
  agents: AgentOption[]
  trigger?: React.ReactNode
}

export function LaunchMissionDialog({ agents, trigger }: LaunchMissionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "")
  const [goal, setGoal] = useState("")
  const [repoUrl, setRepoUrl] = useState("")
  const [branch, setBranch] = useState("main")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedAgent = agents.find((a) => a.id === agentId)

  async function handleLaunch() {
    if (!agentId || !goal.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/jobs/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          goal: goal.trim(),
          ...(repoUrl.trim() ? { context: { repoUrl: repoUrl.trim(), branch: branch.trim() || "main" } } : {}),
        }),
      })

      const body = await res.json()

      if (!res.ok || !body.ok) {
        const msg = body.error || "Launch failed"
        setError(msg)
        toast.error(msg)
        return
      }

      // Extract runId from response
      const runId =
        body.result?.workflow?.runId ??
        body.result?.workflowRunId ??
        body.result?.job?.jobId

      toast.success("Mission launched", { description: `Agent ${agentId} dispatched` })
      setOpen(false)
      setGoal("")

      if (runId) {
        router.push(`/dashboard/runs/${runId}`)
      } else {
        router.push("/dashboard/runs")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <Rocket size={14} />
            Launch Mission
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Launch Mission</DialogTitle>
          <DialogDescription className="text-xs text-secondary-foreground/50">
            Deploy an agent to execute a goal. {selectedAgent?.hasSandbox ? "This agent runs in an isolated Vercel Sandbox." : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          {/* Agent picker */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id} className="text-xs">
                    {agent.name} — {agent.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAgent && (
              <div className="flex gap-2 mt-1">
                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono bg-muted border border-border rounded">
                  {selectedAgent.runtime}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono bg-muted border border-border rounded">
                  {selectedAgent.execution}
                </span>
                {selectedAgent.hasSandbox && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono text-primary bg-primary/10 border border-primary/20 rounded">
                    sandbox
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Goal input */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-[10px] uppercase tracking-widest text-secondary-foreground/50">Mission Goal</Label>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Describe what you want the agent to accomplish..."
              rows={4}
              className="text-xs resize-none"
            />
          </div>

          {/* Coding agent options (sandbox agents only) */}
          {selectedAgent?.hasSandbox && (
            <div className="flex flex-col gap-3 border border-border rounded-md p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="h-auto p-0 text-[10px] uppercase tracking-widest text-secondary-foreground/50 font-medium justify-start gap-1"
              >
                {showAdvanced ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                Coding Agent Options
              </Button>
              {showAdvanced && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Repository URL <span className="opacity-50">(optional)</span>
                    </Label>
                    <Input
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/org/repo"
                      className="text-xs"
                    />
                  </div>
                  {repoUrl && (
                    <div className="flex flex-col gap-1">
                      <Label className="text-[10px] text-muted-foreground">Branch</Label>
                      <Input
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        placeholder="main"
                        className="text-xs"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleLaunch}
            disabled={loading || !goal.trim() || !agentId}
            className="gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Rocket size={12} />
                Launch
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
