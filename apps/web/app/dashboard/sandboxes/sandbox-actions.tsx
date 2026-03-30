"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { vercelFetch } from "@/lib/use-vercel-fetch"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface SandboxActionsProps {
  sandboxId: string
  status: string
  snapshotId?: string
  agentId: string
}

export function SandboxActions({ sandboxId, status, snapshotId, agentId }: SandboxActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleAction(action: string) {
    setLoading(true)
    try {
      const body: Record<string, unknown> = { action }
      if (action === "wake" && snapshotId) {
        body.snapshotId = snapshotId
        body.agentId = agentId
      }

      await vercelFetch(`/api/sandboxes/${sandboxId}`, {
        method: action === "stop" ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      toast.success(`Sandbox ${action} complete`)
      router.refresh()
    } catch (err) {
      toast.error(`Sandbox ${action} failed`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      {loading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
      {status === "running" && (
        <>
          <Button variant="outline" size="sm" onClick={() => handleAction("sleep")} disabled={loading} className="h-6 px-2 text-[10px]">
            Sleep
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleAction("snapshot")} disabled={loading} className="h-6 px-2 text-[10px]">
            Snapshot
          </Button>
        </>
      )}
      {status === "sleeping" && snapshotId && (
        <Button variant="outline" size="sm" onClick={() => handleAction("wake")} disabled={loading} className="h-6 px-2 text-[10px]">
          Wake
        </Button>
      )}
      {(status === "running" || status === "sleeping" || status === "error") && (
        <Button variant="destructive" size="sm" onClick={() => handleAction("stop")} disabled={loading} className="h-6 px-2 text-[10px]">
          Stop
        </Button>
      )}
    </div>
  )
}
