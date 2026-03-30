"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Settings2 } from "lucide-react"

interface AgentConfigDialogProps {
  agentId: string
  agentName: string
  currentModel?: string
  currentRepoUrl?: string
  currentBranch?: string
  trigger?: React.ReactNode
}

export function AgentConfigDialog({
  agentId, agentName, currentModel, currentRepoUrl, currentBranch, trigger,
}: AgentConfigDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(agentName)
  const [model, setModel] = useState(currentModel ?? "")
  const [repoUrl, setRepoUrl] = useState(currentRepoUrl ?? "")
  const [branch, setBranch] = useState(currentBranch ?? "main")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setLoading(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch("/api/agents/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          displayName: displayName.trim() || agentName,
          modelOverride: model.trim() || undefined,
          repoUrl: repoUrl.trim() || undefined,
          repoBranch: branch.trim() || undefined,
        }),
      })

      const body = await res.json()
      if (!res.ok || !body.ok) {
        setError(body.error || "Save failed")
        return
      }

      setSaved(true)
      setTimeout(() => {
        setOpen(false)
        setSaved(false)
        router.refresh()
      }, 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-1.5 text-xs bg-secondary-foreground/5 border border-secondary-foreground/10 rounded-md text-secondary-foreground placeholder:text-secondary-foreground/20 outline-none focus:border-primary/50"
  const labelClass = "text-[10px] uppercase tracking-widest text-secondary-foreground/50 font-medium"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-secondary-foreground/50 border border-secondary-foreground/10 rounded hover:bg-secondary-foreground/5 transition-colors">
            <Settings2 size={10} />
            Configure
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-secondary text-secondary-foreground border-secondary sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Configure {agentName}</DialogTitle>
          <DialogDescription className="text-xs text-secondary-foreground/50">
            Customize this agent's settings. Overrides apply to your account only.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</p>
          )}
          {saved && (
            <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-md px-3 py-2">Saved</p>
          )}

          <div className="flex flex-col gap-1">
            <label className={labelClass}>Display Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={agentName} className={inputClass} />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelClass}>Model Override <span className="opacity-50">(blank = agent default)</span></label>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="anthropic/claude-sonnet-4.5" className={inputClass} />
            <p className="text-[9px] text-secondary-foreground/30">Uses AI Gateway format: provider/model</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelClass}>Default Repository <span className="opacity-50">(optional)</span></label>
            <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repo" className={inputClass} />
          </div>

          {repoUrl && (
            <div className="flex flex-col gap-1">
              <label className={labelClass}>Branch</label>
              <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" className={inputClass} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="text-xs border-secondary-foreground/10">Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium">
            {loading ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
