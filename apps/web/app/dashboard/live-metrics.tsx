"use client"

import { MetricHUD } from "@/components/metric-hud"
import { useLiveStream } from "@/lib/use-live-stream"

interface LiveMetricsProps {
  initialMissions: number
  initialActiveOrbits: number
  initialSignals: number
  initialPending: number
}

export function LiveMetrics({
  initialMissions,
  initialActiveOrbits,
  initialSignals,
  initialPending,
}: LiveMetricsProps) {
  const { connected, snapshot } = useLiveStream()

  const missions = snapshot?.metrics != null ? snapshot.runs.length : initialMissions
  const activeOrbits = snapshot?.metrics != null ? snapshot.metrics.activeRuns : initialActiveOrbits
  const signals = snapshot?.metrics != null ? snapshot.metrics.connectedAgents : initialSignals
  const pending = snapshot?.metrics != null ? snapshot.metrics.pendingApprovals : initialPending

  return (
    <div className="border border-border">
      <div className="relative">
        {/* LIVE / OFFLINE indicator */}
        <div className="absolute top-2 right-2 z-10">
          {connected ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold tracking-widest text-green-400 border border-green-500/30 bg-green-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold tracking-widest text-muted-foreground border border-border bg-background">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
              OFFLINE
            </span>
          )}
        </div>

        <div className="grid md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
          <MetricHUD
            label="MISSIONS"
            value={String(missions)}
            code="LOG.ALL"
          />
          <MetricHUD
            label="ACTIVE ORBITS"
            value={String(activeOrbits)}
            code="TRK.GEO"
          />
          <MetricHUD
            label="SIGNALS"
            value={String(signals)}
            code="RCV.24H"
          />
          <MetricHUD
            label="PENDING"
            value={String(pending)}
            code="LIVE.REC"
            variant={pending > 0 ? "highlight" : "default"}
          />
        </div>
      </div>
    </div>
  )
}
