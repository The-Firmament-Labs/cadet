'use client'

import { useState } from "react"
import Link from "next/link"
import { startAuthentication } from "@simplewebauthn/browser"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePasskeySignIn() {
    if (!email.trim()) {
      setError("Enter your email to find your passkey")
      return
    }
    setLoading(true)
    setError(null)

    try {
      // Step 1: Get authentication options from server
      const optionsRes = await fetch("/api/auth/login?step=options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (!optionsRes.ok) {
        const err = await optionsRes.json().catch(() => ({}))
        throw new Error(err.error || "Failed to get authentication options")
      }
      const options = await optionsRes.json()

      // Step 2: Start WebAuthn authentication (use platform authenticator = Touch ID)
      const credential = await startAuthentication({ ...options, authenticatorAttachment: "platform" })

      // Step 3: Verify credential with server
      const verifyRes = await fetch("/api/auth/login?step=verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      })
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}))
        throw new Error(err.error || "Verification failed")
      }

      // Success — redirect to dashboard
      window.location.href = "/dashboard"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed")
    } finally {
      setLoading(false)
    }
  }

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
            <h1 className="text-sm font-semibold text-secondary-foreground text-center">Sign in</h1>
            <p className="text-xs text-secondary-foreground/50 text-center mt-1">
              Use your passkey to authenticate
            </p>
          </CardHeader>
          <CardContent className="pt-4 flex flex-col gap-4">
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasskeySignIn()}
              className="w-full px-3 py-2 text-xs bg-secondary-foreground/5 border border-secondary-foreground/10 rounded-md text-secondary-foreground placeholder:text-secondary-foreground/30 outline-none focus:border-primary/50"
            />

            <Button
              onClick={handlePasskeySignIn}
              disabled={loading || !email.trim()}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs"
            >
              {loading ? "Authenticating…" : "Sign in with passkey"}
            </Button>

            <p className="text-center text-[11px] text-secondary-foreground/50">
              No account?{" "}
              <Link href="/sign-up" className="text-primary hover:underline">
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
