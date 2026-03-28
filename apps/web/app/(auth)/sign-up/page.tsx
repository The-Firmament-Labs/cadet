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
          <img
            src="/icon.png"
            alt="Cadet"
            className="w-10 h-10"
          />
          <span className="text-lg font-semibold tracking-wide text-foreground">Cadet</span>
        </div>

        <Card className="bg-secondary text-secondary-foreground border-secondary shadow-[var(--glow-primary)]">
          <CardHeader className="pb-2">
            <h1 className="text-sm font-semibold text-secondary-foreground text-center">Create account</h1>
            <p className="text-xs text-secondary-foreground/50 text-center mt-1">
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
              <Label htmlFor="displayName" className="text-xs text-secondary-foreground/50">
                Display name
              </Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Jane Operator"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-8 text-xs bg-[var(--input)] border-secondary-foreground/10"
                autoComplete="name"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs text-secondary-foreground/50">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-xs bg-[var(--input)] border-secondary-foreground/10"
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

            <p className="text-center text-[11px] text-secondary-foreground/50">
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
