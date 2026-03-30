"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { vercelFetch } from "@/lib/use-vercel-fetch"

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

      router.refresh()
    } catch {
      // Error handled by vercelFetch
    } finally {
      setLoading(false)
    }
  }

  const buttonClass = "px-2 py-1 text-[10px] font-medium border rounded transition-colors disabled:opacity-50"

  return (
    <div className="flex items-center gap-1 justify-end">
      {status === "running" && (
        <>
          <button
            onClick={() => handleAction("sleep")}
            disabled={loading}
            className={`${buttonClass} text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/10`}
          >
            Sleep
          </button>
          <button
            onClick={() => handleAction("snapshot")}
            disabled={loading}
            className={`${buttonClass} text-blue-400 border-blue-500/20 hover:bg-blue-500/10`}
          >
            Snapshot
          </button>
        </>
      )}
      {status === "sleeping" && snapshotId && (
        <button
          onClick={() => handleAction("wake")}
          disabled={loading}
          className={`${buttonClass} text-green-400 border-green-500/20 hover:bg-green-500/10`}
        >
          Wake
        </button>
      )}
      {(status === "running" || status === "sleeping" || status === "error") && (
        <button
          onClick={() => handleAction("stop")}
          disabled={loading}
          className={`${buttonClass} text-red-400 border-red-500/20 hover:bg-red-500/10`}
        >
          Stop
        </button>
      )}
    </div>
  )
}
