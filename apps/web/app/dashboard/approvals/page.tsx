import { ShieldCheck } from "lucide-react"

import { getOperatorSpacetimeToken, getOperatorSession } from "@/lib/auth"
import { loadInbox } from "@/lib/server"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import { ApprovalActions } from "./approval-actions"

export const dynamic = "force-dynamic"

const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

function riskOrder(risk: string): number {
  return RISK_ORDER[risk.toLowerCase()] ?? 99
}

export default async function ApprovalsPage() {
  const session = await getOperatorSession()
  let approvals: Awaited<ReturnType<typeof loadInbox>>["approvals"] = []
  let error: string | null = null

  try {
    const inbox = await loadInbox(getOperatorSpacetimeToken(session))
    approvals = inbox.approvals
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load approvals"
  }

  const sorted = [...approvals].sort(
    (a, b) => riskOrder(a.risk) - riskOrder(b.risk)
  )

  const pending = sorted.filter((a) => a.status === "pending")
  const resolved = sorted.filter((a) => a.status !== "pending")

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-primary" />
        <h1 className="text-sm font-semibold tracking-wide">Approval Queue</h1>
        {pending.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-[rgba(255,214,107,0.12)] text-[#ffd66b] border border-[rgba(255,214,107,0.28)]">
            {pending.length} pending
          </span>
        )}
      </div>

      {error ? (
        <div className="py-8 text-center">
          <p className="text-sm text-destructive font-mono">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Confirm SpacetimeDB is reachable.
          </p>
        </div>
      ) : approvals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <ShieldCheck size={28} className="text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No active approval gates.</p>
          <p className="text-xs text-muted-foreground opacity-60">
            Low-risk browsing and triage are still autonomous.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending approvals */}
          {pending.length > 0 && (
            <section className="space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Pending
              </p>
              {pending.map((approval) => (
                <Card key={approval.approvalId} className="bg-secondary text-secondary-foreground border-secondary">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={approval.risk} />
                          <span className="text-xs font-medium">{approval.title}</span>
                        </div>
                        <p className="text-[10px] font-mono text-secondary-foreground/50">
                          {approval.agentId ?? "unknown agent"}
                        </p>
                      </div>
                      <ApprovalActions
                        approvalId={approval.approvalId}
                        runId={approval.runId}
                      />
                    </div>
                    {approval.detail ? (
                      <p className="text-xs text-secondary-foreground/50 leading-relaxed">
                        {approval.detail}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {/* Resolved approvals */}
          {resolved.length > 0 && (
            <section className="space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Resolved
              </p>
              {resolved.map((approval) => (
                <Card key={approval.approvalId} className="bg-secondary text-secondary-foreground border-secondary opacity-60">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={approval.risk} />
                      <StatusBadge status={approval.status} />
                      <span className="text-xs font-medium">{approval.title}</span>
                    </div>
                    <p className="text-[10px] font-mono text-secondary-foreground/50">
                      {approval.agentId ?? "unknown agent"}
                    </p>
                    {approval.detail ? (
                      <p className="text-xs text-secondary-foreground/50 leading-relaxed">
                        {approval.detail}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
