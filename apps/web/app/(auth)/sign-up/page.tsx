'use client'

import { useState } from "react"
import Link from "next/link"
import { startRegistration } from "@simplewebauthn/browser"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreatePasskey() {
    setLoading(true)
    setError(null)

    try {
      // TODO: Fetch registration options from /api/auth/register/options
      // const optionsRes = await fetch("/api/auth/register/options", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ displayName, email }),
      // })
      // const options = await optionsRes.json()

      // TODO: Call startRegistration with options from the server
      // const credential = await startRegistration(options)

      // TODO: Send credential to /api/auth/register/verify
      // const verifyRes = await fetch("/api/auth/register/verify", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ credential, displayName, email }),
      // })
      // if (!verifyRes.ok) throw new Error("Registration failed")
      // router.push("/dashboard")

      // Suppress unused import warning until API routes are built
      void startRegistration
      throw new Error("Auth API routes not yet implemented")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = displayName.trim().length > 0 && email.trim().length > 0

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div
            className={cn(
              "flex items-center justify-center w-7 h-7",
              "rounded-sm border border-primary/40",
              "text-primary font-mono font-bold text-sm leading-none",
              "shadow-[0_0_12px_rgba(0,229,255,0.2)]"
            )}
          >
            C
          </div>
          <span className="text-lg font-semibold tracking-wide text-foreground">Cadet</span>
        </div>

        <Card className="border-border bg-[var(--card)] shadow-[var(--glow-primary)]">
          <CardHeader className="pb-2">
            <h1 className="text-sm font-semibold text-foreground text-center">Create account</h1>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Register with a passkey — no password needed
            </p>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-4">
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName" className="text-xs text-muted-foreground">
                Display name
              </Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Jane Operator"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-8 text-xs bg-[var(--input)] border-border"
                autoComplete="name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-xs bg-[var(--input)] border-border"
                autoComplete="email"
              />
            </div>

            <Button
              onClick={handleCreatePasskey}
              disabled={loading || !canSubmit}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs mt-1"
            >
              {loading ? "Creating passkey…" : "Create passkey"}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
