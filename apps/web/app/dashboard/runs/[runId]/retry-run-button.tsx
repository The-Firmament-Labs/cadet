"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RotateCcw, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function RetryRunButton({ runId }: { runId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function handleRetry() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/runs/${runId}/retry`, { method: "POST" })
      if (res.ok) {
        toast.success("Retry queued")
        router.refresh()
      } else {
        toast.error("Retry failed")
        setError(true)
      }
    } catch {
      toast.error("Retry failed")
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      disabled={loading}
      className={`ml-2 h-5 px-2 gap-1 text-[10px] ${error ? "text-destructive border-destructive/30" : ""}`}
    >
      {loading ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
      {loading ? "Retrying..." : error ? "Retry failed" : "Retry"}
    </Button>
  )
}
