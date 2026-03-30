"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Settings2, Loader2 } from "lucide-react"
import { toast } from "sonner"

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

      toast.success("Configuration saved")
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

  const labelClass = "text-[10px] uppercase tracking-widest text-secondary-foreground/50"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="h-6 px-2 gap-1 text-[10px] text-muted-foreground">
            <Settings2 size={10} />
            Configure
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
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
            <p className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2">Saved</p>
          )}

          <div className="flex flex-col gap-1">
            <Label className={labelClass}>Display Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={agentName} className="text-xs" />
          </div>

          <div className="flex flex-col gap-1">
            <Label className={labelClass}>Model Override <span className="opacity-50">(blank = agent default)</span></Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="anthropic/claude-sonnet-4.5" className="text-xs" />
            <p className="text-[9px] text-muted-foreground">Uses AI Gateway format: provider/model</p>
          </div>

          <div className="flex flex-col gap-1">
            <Label className={labelClass}>Default Repository <span className="opacity-50">(optional)</span></Label>
            <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repo" className="text-xs" />
          </div>

          {repoUrl && (
            <div className="flex flex-col gap-1">
              <Label className={labelClass}>Branch</Label>
              <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" className="text-xs" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={loading} className="gap-1.5">
            {loading ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
