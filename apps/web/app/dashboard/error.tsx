"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[dashboard] error boundary:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <AlertTriangle size={32} className="text-destructive" />
      <div className="text-center space-y-1">
        <h2 className="text-sm font-semibold">Something went wrong</h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          {error.message.includes("SpacetimeDB") || error.message.includes("ECONNREFUSED")
            ? "Could not connect to SpacetimeDB. Check that the database is running."
            : "An unexpected error occurred loading this page."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
