"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"

export function RetryRunButton({ runId }: { runId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRetry() {
    setLoading(true)
    try {
      const res = await fetch(`/api/runs/${runId}/retry`, { method: "POST" })
      if (res.ok) {
        router.refresh()
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20 rounded hover:bg-primary/10 transition-colors disabled:opacity-50"
    >
      <RotateCcw size={10} className={loading ? "animate-spin" : ""} />
      {loading ? "Retrying..." : "Retry"}
    </button>
  )
}
