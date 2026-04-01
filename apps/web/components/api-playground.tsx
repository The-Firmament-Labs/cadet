"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Play, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { ApiEndpoint } from "@/lib/api-registry"
import { METHOD_COLORS } from "@/lib/api-registry"

interface ApiPlaygroundProps {
  endpoint: ApiEndpoint
}

export function ApiPlayground({ endpoint }: ApiPlaygroundProps) {
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [bodyText, setBodyText] = useState(() => {
    if (!endpoint.body?.length) return ""
    const obj: Record<string, unknown> = {}
    for (const p of endpoint.body) {
      obj[p.name] = p.type === "boolean" ? true : p.type === "number" ? 0 : ""
    }
    return JSON.stringify(obj, null, 2)
  })
  const [response, setResponse] = useState<{ status: number; body: string; time: number } | null>(null)
  const [loading, setLoading] = useState(false)

  // Build the URL with path params substituted
  function buildUrl(): string {
    let path = endpoint.path
    // Replace {param} with values
    for (const [key, val] of Object.entries(paramValues)) {
      path = path.replace(`{${key}}`, encodeURIComponent(val))
    }
    // Add query params for GET
    if (endpoint.method === "GET" && endpoint.params?.length) {
      const qs = new URLSearchParams()
      for (const p of endpoint.params) {
        const val = paramValues[p.name]
        if (val) qs.set(p.name, val)
      }
      const str = qs.toString()
      if (str) path += `?${str}`
    }
    return path
  }

  async function handleSend() {
    setLoading(true)
    setResponse(null)
    const url = buildUrl()
    const start = performance.now()

    try {
      const init: RequestInit = { method: endpoint.method }
      if (endpoint.method !== "GET" && bodyText.trim()) {
        init.headers = { "Content-Type": "application/json" }
        init.body = bodyText
      }

      const res = await fetch(url, init)
      const text = await res.text()
      const time = Math.round(performance.now() - start)

      let formatted: string
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        formatted = text
      }

      setResponse({ status: res.status, body: formatted, time })
    } catch (err) {
      setResponse({ status: 0, body: err instanceof Error ? err.message : "Request failed", time: Math.round(performance.now() - start) })
    } finally {
      setLoading(false)
    }
  }

  function buildCurl(): string {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}${buildUrl()}`
    let cmd = `curl -s`
    if (endpoint.method !== "GET") cmd += ` -X ${endpoint.method}`
    if (endpoint.auth === "session") cmd += ` -H "Cookie: cadet_session=YOUR_SESSION"`
    if (endpoint.auth === "cron") cmd += ` -H "Authorization: Bearer YOUR_CRON_SECRET"`
    if (endpoint.method !== "GET" && bodyText.trim()) {
      cmd += ` -H "Content-Type: application/json"`
      cmd += ` -d '${bodyText.replace(/\n/g, "").replace(/'/g, "'\\''")}'`
    }
    cmd += ` "${url}"`
    return cmd
  }

  function copyCurl() {
    navigator.clipboard.writeText(buildCurl())
    toast.success("cURL copied to clipboard")
  }

  // Extract path params like {agentId}
  const pathParams = endpoint.path.match(/\{(\w+)\}/g)?.map((p) => p.slice(1, -1)) ?? []

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className={`text-xs font-mono font-bold shrink-0 w-14 ${METHOD_COLORS[endpoint.method]}`}>
          {endpoint.method}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-foreground break-all">{endpoint.path}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{endpoint.description}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono rounded border ${
              endpoint.auth === "none" ? "text-muted-foreground border-border" :
              endpoint.auth === "session" ? "text-primary border-primary/20" :
              endpoint.auth === "cron" ? "text-yellow-500 border-yellow-500/20" :
              "text-muted-foreground border-border"
            }`}>
              {endpoint.auth}
            </span>
            {endpoint.response && (
              <span className="text-[9px] text-muted-foreground font-mono truncate">{endpoint.response}</span>
            )}
          </div>
        </div>
      </div>

      {/* Path params */}
      {pathParams.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Path Parameters</Label>
          {pathParams.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-20 shrink-0">{p}</span>
              <Input
                value={paramValues[p] ?? ""}
                onChange={(e) => setParamValues({ ...paramValues, [p]: e.target.value })}
                placeholder={p}
                className="text-xs h-7"
              />
            </div>
          ))}
        </div>
      )}

      {/* Query params */}
      {endpoint.params && endpoint.params.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Query Parameters</Label>
          {endpoint.params.map((p) => (
            <div key={p.name} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-20 shrink-0">
                {p.name}{p.required && <span className="text-destructive">*</span>}
              </span>
              <Input
                value={paramValues[p.name] ?? ""}
                onChange={(e) => setParamValues({ ...paramValues, [p.name]: e.target.value })}
                placeholder={`${p.type} — ${p.description}`}
                className="text-xs h-7"
              />
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      {endpoint.body && endpoint.body.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Request Body</Label>
          <Textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={6}
            className="text-xs font-mono resize-y"
            placeholder="JSON body"
          />
          <div className="flex gap-1 flex-wrap">
            {endpoint.body.map((p) => (
              <span key={p.name} className="text-[9px] font-mono text-muted-foreground">
                {p.name}{p.required && "*"}: {p.type}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSend} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Send
        </Button>
        <Button variant="outline" size="sm" onClick={copyCurl} className="gap-1.5">
          <Copy size={12} />
          Copy cURL
        </Button>
      </div>

      {/* Response */}
      {response && (
        <Card className="border-border">
          <CardHeader className="py-2 px-3 border-b border-border">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-mono font-bold ${response.status >= 200 && response.status < 300 ? "text-primary" : "text-destructive"}`}>
                {response.status || "ERR"}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">{response.time}ms</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="p-3 text-[10px] font-mono text-foreground/80 overflow-x-auto max-h-[300px] overflow-y-auto">
              {response.body}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
