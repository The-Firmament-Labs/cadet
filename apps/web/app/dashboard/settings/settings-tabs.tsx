"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface KVRow {
  label: string
  value: string
  mono?: boolean
  redact?: boolean
}

interface ApiEndpoint {
  method: string
  path: string
  description: string
}

interface SettingsTabsProps {
  controlPlane: KVRow[]
  apiEndpoints: ApiEndpoint[]
}

function KVTable({ rows }: { rows: KVRow[] }) {
  return (
    <div className="divide-y divide-border">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start gap-4 py-2.5 px-4">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground w-40 shrink-0 pt-0.5">
            {row.label}
          </span>
          <span
            className={
              row.mono
                ? "text-xs font-mono text-foreground break-all"
                : "text-xs text-foreground break-all"
            }
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SettingsTabs({ controlPlane, apiEndpoints }: SettingsTabsProps) {
  return (
    <Tabs defaultValue="control-plane">
      <TabsList className="mb-4">
        <TabsTrigger value="control-plane">Control Plane</TabsTrigger>
        <TabsTrigger value="operators">Operators</TabsTrigger>
        <TabsTrigger value="api">API</TabsTrigger>
      </TabsList>

      {/* Control Plane */}
      <TabsContent value="control-plane">
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              Control Plane Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <KVTable rows={controlPlane} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Operators */}
      <TabsContent value="operators">
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              Operator Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Operator management coming soon.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      {/* API */}
      <TabsContent value="api">
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              API Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {apiEndpoints.map((ep) => (
                <div key={`${ep.method}:${ep.path}`} className="flex items-start gap-4 py-2.5 px-4">
                  <span className="shrink-0 w-12 text-[10px] font-mono font-bold text-primary">
                    {ep.method}
                  </span>
                  <span className="shrink-0 w-56 text-[11px] font-mono text-foreground">
                    {ep.path}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ep.description}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
