import { MessageSquare } from "lucide-react"

import { getOperatorSpacetimeToken, getOperatorSession } from "@/lib/auth"
import { loadInbox } from "@/lib/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function ThreadsPage() {
  const session = await getOperatorSession()
  let threads: Awaited<ReturnType<typeof loadInbox>>["threads"] = []
  let error: string | null = null

  try {
    const inbox = await loadInbox(getOperatorSpacetimeToken(session))
    threads = inbox.threads
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load threads"
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare size={18} className="text-primary" />
        <h1 className="text-sm font-semibold tracking-wide">Conversation Threads</h1>
      </div>

      {error ? (
        <div className="py-8 text-center">
          <p className="text-sm text-destructive font-mono">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Confirm SpacetimeDB is reachable.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-12rem)]">
          {/* Thread list */}
          <div className="overflow-y-auto space-y-2 pr-1">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <MessageSquare size={24} className="opacity-30" />
                <p className="text-sm">No threads yet.</p>
              </div>
            ) : (
              threads.map((thread) => (
                <Card key={thread.threadId} className="bg-secondary text-secondary-foreground border-secondary cursor-default hover:ring-primary/30 transition-shadow">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MessageSquare
                          size={12}
                          className="text-secondary-foreground/50 shrink-0"
                        />
                        <span className="text-[10px] font-mono text-secondary-foreground/50 uppercase tracking-wide truncate">
                          {thread.channel}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-secondary-foreground/50 opacity-50 shrink-0">
                        {new Date(thread.updatedAtMicros / 1000).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs font-medium leading-snug truncate">
                      {thread.title}
                    </p>
                    <div className="flex items-center gap-1 text-[9px] font-mono text-secondary-foreground/50 opacity-60">
                      <span className="truncate">{thread.threadId}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Message panel placeholder */}
          <Card className="bg-secondary text-secondary-foreground border-secondary flex flex-col">
            <CardHeader className="border-b border-secondary-foreground/10 pb-3 shrink-0">
              <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <MessageSquare size={28} className="mx-auto text-secondary-foreground/50 opacity-20" />
                <p className="text-sm text-secondary-foreground/50">
                  Select a thread to view messages
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
