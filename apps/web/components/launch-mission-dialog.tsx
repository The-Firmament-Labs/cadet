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
import { Rocket } from "lucide-react"

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
        setError(body.error || "Launch failed")
        return
      }

      // Extract runId from response
      const runId =
        body.result?.workflow?.runId ??
        body.result?.workflowRunId ??
        body.result?.job?.jobId

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
          <Button className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium">
            <Rocket size={14} />
            Launch Mission
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-secondary text-secondary-foreground border-secondary sm:max-w-md">
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
            <label className="text-[10px] uppercase tracking-widest text-secondary-foreground/50 font-medium">
              Agent
            </label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-secondary-foreground/5 border border-secondary-foreground/10 rounded-md text-secondary-foreground outline-none focus:border-primary/50"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} — {agent.description}
                </option>
              ))}
            </select>
            {selectedAgent && (
              <div className="flex gap-2 mt-1">
                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono bg-secondary-foreground/5 border border-secondary-foreground/10 rounded">
                  {selectedAgent.runtime}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono bg-secondary-foreground/5 border border-secondary-foreground/10 rounded">
                  {selectedAgent.execution}
                </span>
                {selectedAgent.hasSandbox && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 rounded">
                    sandbox
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Goal input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-widest text-secondary-foreground/50 font-medium">
              Mission Goal
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Describe what you want the agent to accomplish..."
              rows={4}
              className="w-full px-3 py-2 text-xs bg-secondary-foreground/5 border border-secondary-foreground/10 rounded-md text-secondary-foreground placeholder:text-secondary-foreground/30 outline-none focus:border-primary/50 resize-none"
            />
          </div>

          {/* Coding agent options (sandbox agents only) */}
          {selectedAgent?.hasSandbox && (
            <div className="flex flex-col gap-3 border border-secondary-foreground/10 rounded-md p-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[10px] uppercase tracking-widest text-secondary-foreground/50 font-medium text-left flex items-center gap-1"
              >
                Coding Agent Options
                <span className="text-[8px]">{showAdvanced ? "▼" : "▶"}</span>
              </button>
              {showAdvanced && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-secondary-foreground/40">
                      Repository URL <span className="opacity-50">(optional — leave empty for blank workspace)</span>
                    </label>
                    <input
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/org/repo"
                      className="w-full px-3 py-1.5 text-xs bg-secondary-foreground/5 border border-secondary-foreground/10 rounded-md text-secondary-foreground placeholder:text-secondary-foreground/20 outline-none focus:border-primary/50"
                    />
                  </div>
                  {repoUrl && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-secondary-foreground/40">Branch</label>
                      <input
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        placeholder="main"
                        className="w-full px-3 py-1.5 text-xs bg-secondary-foreground/5 border border-secondary-foreground/10 rounded-md text-secondary-foreground placeholder:text-secondary-foreground/20 outline-none focus:border-primary/50"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="text-xs border-secondary-foreground/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={loading || !goal.trim() || !agentId}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
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
