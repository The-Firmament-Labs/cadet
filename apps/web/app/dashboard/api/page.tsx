"use client"

import { useState, useMemo } from "react"
import { Code2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ApiPlayground } from "@/components/api-playground"
import { API_REGISTRY, CATEGORY_LABELS, METHOD_COLORS, type ApiEndpoint, type ApiCategory } from "@/lib/api-registry"

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ApiCategory[]

export default function ApiExplorerPage() {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<ApiCategory | "all">("all")
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null)

  const filtered = useMemo(() => {
    return API_REGISTRY.filter((ep) => {
      if (selectedCategory !== "all" && ep.category !== selectedCategory) return false
      if (search) {
        const q = search.toLowerCase()
        return ep.path.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q) || ep.method.toLowerCase().includes(q)
      }
      return true
    })
  }, [search, selectedCategory])

  const grouped = useMemo(() => {
    const groups: Record<string, ApiEndpoint[]> = {}
    for (const ep of filtered) {
      const cat = CATEGORY_LABELS[ep.category] || ep.category
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(ep)
    }
    return groups
  }, [filtered])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Code2 size={18} className="text-primary" />
        <h1 className="text-sm font-semibold tracking-wide">API Explorer</h1>
        <span className="text-[10px] text-muted-foreground font-mono ml-auto">{API_REGISTRY.length} endpoints</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-180px)]">
        {/* Left panel: endpoint list */}
        <div className="flex flex-col gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search endpoints..."
              className="pl-8 text-xs h-8"
            />
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors ${
                selectedCategory === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/20"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors ${
                  selectedCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/20"
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Endpoint list */}
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-2">
              {Object.entries(grouped).map(([category, endpoints]) => (
                <div key={category}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1.5 px-1">
                    {category}
                  </p>
                  <div className="space-y-0.5">
                    {endpoints.map((ep) => (
                      <button
                        key={`${ep.method}:${ep.path}`}
                        onClick={() => setSelectedEndpoint(ep)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                          selectedEndpoint === ep ? "bg-accent" : "hover:bg-muted"
                        }`}
                      >
                        <span className={`font-mono font-bold text-[10px] w-12 shrink-0 ${METHOD_COLORS[ep.method]}`}>
                          {ep.method}
                        </span>
                        <span className="font-mono text-foreground/80 truncate">{ep.path}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(grouped).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No matching endpoints</p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right panel: playground */}
        <Card className="overflow-hidden">
          <CardContent className="p-4 h-full overflow-y-auto">
            {selectedEndpoint ? (
              <ApiPlayground endpoint={selectedEndpoint} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Code2 size={28} className="opacity-30" />
                <p className="text-xs">Select an endpoint to try it</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
