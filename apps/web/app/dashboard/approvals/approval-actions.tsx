"use client"

import { useState } from "react"
import { Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ApprovalActionsProps {
  approvalId: string
  runId?: string
}

export function ApprovalActions({ approvalId, runId }: ApprovalActionsProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "approved" | "rejected">("idle")

  async function resolve(action: "approved" | "rejected") {
    setStatus("loading")
    try {
      const res = await fetch(`/api/approvals/${approvalId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, resolvedBy: "operator" }),
      })
      if (res.ok) {
        setStatus(action)
      } else {
        setStatus("idle")
      }
    } catch {
      setStatus("idle")
    }
  }

  if (status === "approved") {
    return <span className="text-xs font-mono text-primary">Approved</span>
  }

  if (status === "rejected") {
    return <span className="text-xs font-mono text-destructive">Rejected</span>
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-[11px] text-primary border-primary/30 hover:bg-primary/10"
        disabled={status === "loading"}
        onClick={() => resolve("approved")}
      >
        {status === "loading" ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Check size={12} className="mr-1" />}
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10"
        disabled={status === "loading"}
        onClick={() => resolve("rejected")}
      >
        <X size={12} className="mr-1" />
        Reject
      </Button>
    </div>
  )
}
