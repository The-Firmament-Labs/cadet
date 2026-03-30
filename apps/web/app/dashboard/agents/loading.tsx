import { Card, CardContent, CardHeader } from "@/components/ui/card"

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

export default function AgentsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-32" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i} className="bg-secondary text-secondary-foreground border-secondary">
          <CardHeader className="border-b border-secondary-foreground/10 pb-3">
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
