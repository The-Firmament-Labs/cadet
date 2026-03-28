"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
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
    return (
      <span className="text-xs font-mono text-[#4dff88]">Approved</span>
    )
  }

  if (status === "rejected") {
    return (
      <span className="text-xs font-mono text-[#ff4d4d]">Rejected</span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-[11px] border-[rgba(77,255,136,0.3)] text-[#4dff88] hover:bg-[rgba(77,255,136,0.08)] hover:text-[#4dff88]"
        disabled={status === "loading"}
        onClick={() => resolve("approved")}
      >
        <Check size={12} className="mr-1" />
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2.5 text-[11px] border-[rgba(255,77,77,0.3)] text-[#ff4d4d] hover:bg-[rgba(255,77,77,0.08)] hover:text-[#ff4d4d]"
        disabled={status === "loading"}
        onClick={() => resolve("rejected")}
      >
        <X size={12} className="mr-1" />
        Reject
      </Button>
    </div>
  )
}
