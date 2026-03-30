import { Card, CardContent, CardHeader } from "@/components/ui/card"

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Metrics skeleton */}
      <div className="border border-border">
        <div className="grid md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </div>
      </div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card className="bg-secondary text-secondary-foreground border-secondary">
            <CardHeader className="border-b border-secondary-foreground/10 pb-3">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
        <div>
          <Card className="bg-secondary text-secondary-foreground border-secondary">
            <CardHeader className="border-b border-secondary-foreground/10 pb-3">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
