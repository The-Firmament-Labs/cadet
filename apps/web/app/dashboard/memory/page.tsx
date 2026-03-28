import { Brain } from "lucide-react"

import { createControlClient } from "@/lib/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

export const dynamic = "force-dynamic"

interface MemoryDocument {
  document_id: string
  agent_id: string
  namespace?: string | null
  title?: string | null
  source_kind?: string | null
  content?: string | null
  updated_at_micros?: number | null
}

function groupByAgent(docs: MemoryDocument[]): Record<string, MemoryDocument[]> {
  return docs.reduce<Record<string, MemoryDocument[]>>((acc, doc) => {
    const key = doc.agent_id ?? "unknown"
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {})
}

export default async function MemoryPage() {
  let docs: MemoryDocument[] = []
  let error: string | null = null

  try {
    const client = createControlClient()
    const rows = await client.sql(
      "SELECT * FROM memory_document ORDER BY updated_at_micros DESC"
    )
    docs = rows as MemoryDocument[]
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load memory documents"
  }

  const grouped = groupByAgent(docs)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain size={18} className="text-primary" />
        <h1 className="text-sm font-semibold tracking-wide">Memory Documents</h1>
        {docs.length > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {docs.length} document{docs.length !== 1 ? "s" : ""}
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
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Brain size={28} className="text-muted-foreground opacity-20" />
          <p className="text-sm text-muted-foreground">No memory documents yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([agentId, agentDocs]) => (
            <section key={agentId} className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {agentId}
                </p>
                <span className="text-[9px] font-mono text-muted-foreground opacity-50">
                  {agentDocs.length} doc{agentDocs.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {agentDocs.map((doc) => (
                  <Card key={doc.document_id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-medium leading-snug">
                        {doc.title ?? doc.document_id}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {doc.namespace ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-[rgba(0,229,255,0.08)] text-[rgba(0,229,255,0.7)] border border-[rgba(0,229,255,0.16)]">
                            {doc.namespace}
                          </span>
                        ) : null}
                        {doc.source_kind ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-[rgba(220,228,255,0.06)] text-muted-foreground border border-border">
                            {doc.source_kind}
                          </span>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {doc.content ? (
                        <ScrollArea className="h-[80px]">
                          <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                            {doc.content.slice(0, 200)}
                            {doc.content.length > 200 ? "…" : ""}
                          </p>
                        </ScrollArea>
                      ) : (
                        <p className="text-[11px] text-muted-foreground opacity-40 italic">
                          No content
                        </p>
                      )}
                      {doc.updated_at_micros ? (
                        <p className="text-[9px] font-mono text-muted-foreground opacity-40 mt-2">
                          {new Date(doc.updated_at_micros / 1000).toLocaleString()}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
