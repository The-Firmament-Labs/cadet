"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface KVRow {
  label: string
  value: string
  mono?: boolean
  link?: string
}

interface ApiEndpoint {
  method: string
  path: string
  description: string
}

interface OperatorInfo {
  displayName: string
  email: string
  role: string
  operatorId: string
  hasVercelConnection: boolean
  vercelUserId?: string
}

interface SettingsTabsProps {
  controlPlane: KVRow[]
  apiEndpoints: ApiEndpoint[]
  operator?: OperatorInfo | null
}

function KVTable({ rows }: { rows: KVRow[] }) {
  return (
    <div className="divide-y divide-secondary-foreground/10">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start gap-4 py-2.5 px-4">
          <span className="text-[10px] uppercase tracking-widest text-secondary-foreground/50 w-40 shrink-0 pt-0.5">
            {row.label}
          </span>
          <span
            className={
              row.mono
                ? "text-xs font-mono text-secondary-foreground break-all"
                : "text-xs text-secondary-foreground break-all"
            }
          >
            {row.link ? (
              <a href={row.link} className="text-primary hover:underline">{row.value}</a>
            ) : (
              row.value
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

export function SettingsTabs({ controlPlane, apiEndpoints, operator }: SettingsTabsProps) {
  return (
    <Tabs defaultValue="control-plane">
      <TabsList className="mb-4">
        <TabsTrigger value="control-plane">Control Plane</TabsTrigger>
        <TabsTrigger value="operators">Operator</TabsTrigger>
        <TabsTrigger value="api">API</TabsTrigger>
      </TabsList>

      {/* Control Plane */}
      <TabsContent value="control-plane">
        <Card className="bg-secondary text-secondary-foreground border-secondary">
          <CardHeader className="border-b border-secondary-foreground/10 pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
              Control Plane Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <KVTable rows={controlPlane} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Operator Profile */}
      <TabsContent value="operators">
        <Card className="bg-secondary text-secondary-foreground border-secondary">
          <CardHeader className="border-b border-secondary-foreground/10 pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
              Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {operator ? (
              <KVTable rows={[
                { label: "Display Name", value: operator.displayName },
                { label: "Email", value: operator.email, mono: true },
                { label: "Role", value: operator.role },
                { label: "Operator ID", value: operator.operatorId, mono: true },
                {
                  label: "Vercel Account",
                  value: operator.hasVercelConnection
                    ? `Connected${operator.vercelUserId ? ` (${operator.vercelUserId})` : ""}`
                    : "Not connected",
                  ...(operator.hasVercelConnection
                    ? {}
                    : { link: "/api/auth/vercel/authorize" }),
                },
              ]} />
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-secondary-foreground/50">
                  Session not available. Try signing in again.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* API */}
      <TabsContent value="api">
        <Card className="bg-secondary text-secondary-foreground border-secondary">
          <CardHeader className="border-b border-secondary-foreground/10 pb-3">
            <CardTitle className="text-sm font-medium text-secondary-foreground/50 uppercase tracking-widest">
              API Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-secondary-foreground/10">
              {apiEndpoints.map((ep) => (
                <div key={`${ep.method}:${ep.path}`} className="flex items-start gap-4 py-2.5 px-4">
                  <span className="shrink-0 w-12 text-[10px] font-mono font-bold text-primary">
                    {ep.method}
                  </span>
                  <span className="shrink-0 w-56 text-[11px] font-mono text-secondary-foreground">
                    {ep.path}
                  </span>
                  <span className="text-xs text-secondary-foreground/50">
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
