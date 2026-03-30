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
      // Step 1: Get registration options
      const optionsRes = await fetch("/api/auth/register?step=options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() || email.split("@")[0] || "operator", email }),
      })
      if (!optionsRes.ok) {
        const err = await optionsRes.json().catch(() => ({}))
        throw new Error(err.error || "Failed to get registration options")
      }
      const options = await optionsRes.json()

      // Step 2: Create passkey (browser prompt) — v13 API
      const credential = await startRegistration({ optionsJSON: options })

      // Step 3: Verify with server
      const verifyRes = await fetch("/api/auth/register?step=verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      })
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}))
        throw new Error(err.error || "Registration failed")
      }

      // Step 4: Generate SSH key pair for cloud access
      try {
        const sshRes = await fetch("/api/auth/ssh-key", { method: "POST" })
        if (sshRes.ok) {
          const sshData = await sshRes.json()
          // Download the private key as a file
          const blob = new Blob([sshData.privateKey], { type: "text/plain" })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = "cadet_ed25519"
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      } catch {
        // SSH key generation is optional — don't block sign-up
      }

      // Success — redirect to dashboard
      window.location.href = "/dashboard"
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
            src="/visuals/retro-astro.png"
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
