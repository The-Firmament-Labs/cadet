'use client'

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { startAuthentication } from "@simplewebauthn/browser"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Path A: Conditional UI — passkey autofill on page load
  // This shows the passkey in the browser's autofill dropdown (no modal, no QR code)
  useEffect(() => {
    let cancelled = false

    async function setupConditionalUI() {
      // Check if the browser supports conditional mediation
      if (!window.PublicKeyCredential?.isConditionalMediationAvailable) return
      const available = await PublicKeyCredential.isConditionalMediationAvailable()
      if (!available || cancelled) return

      try {
        // Get options with empty allowCredentials for conditional UI
        const res = await fetch("/api/auth/login?step=options&conditional=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
        if (!res.ok || cancelled) return
        const options = await res.json()

        // Start authentication in autofill mode — no modal, just a dropdown
        const credential = await startAuthentication({
          optionsJSON: options,
          useBrowserAutofill: true,
        })

        if (cancelled) return

        // Auto-verify and redirect
        const verifyRes = await fetch("/api/auth/login?step=verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credential),
        })
        if (verifyRes.ok) {
          const isDesktop = new URLSearchParams(window.location.search).get("desktop") === "true"
          window.location.href = isDesktop ? "/desktop-callback" : "/dashboard"
        }
      } catch {
        // User dismissed autofill or browser doesn't support it — fine,
        // they can use the button (Path B)
      }
    }

    setupConditionalUI()
    return () => { cancelled = true }
  }, [])

  // Path B: Button click — modal fallback for explicit sign-in
  async function handlePasskeySignIn() {
    if (!email.trim()) {
      setError("Enter your email to find your passkey")
      return
    }
    setLoading(true)
    setError(null)

    // Cancel any pending conditional UI request
    abortRef.current?.abort()

    try {
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

      const credential = await startAuthentication({ optionsJSON: options })

      const verifyRes = await fetch("/api/auth/login?step=verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      })
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}))
        throw new Error(err.error || "Verification failed")
      }

      const isDesktop = new URLSearchParams(window.location.search).get("desktop") === "true"
      window.location.href = isDesktop ? "/desktop-callback" : "/dashboard"
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

            {/* autocomplete="username webauthn" enables conditional UI autofill */}
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasskeySignIn()}
              autoComplete="username webauthn"
              autoFocus
              className="w-full px-3 py-2 text-xs bg-secondary-foreground/5 border border-secondary-foreground/10 rounded-md text-secondary-foreground placeholder:text-secondary-foreground/30 outline-none focus:border-primary/50"
            />

            <Button
              onClick={handlePasskeySignIn}
              disabled={loading || !email.trim()}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs"
            >
              {loading ? "Authenticating…" : "Sign in with passkey"}
            </Button>

            {process.env.NEXT_PUBLIC_VERCEL_OAUTH_ENABLED === "true" && (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-secondary-foreground/10" />
                  <span className="text-[10px] text-secondary-foreground/30 uppercase">or</span>
                  <div className="flex-1 h-px bg-secondary-foreground/10" />
                </div>
                <a
                  href={`/api/auth/vercel/authorize${typeof window !== "undefined" && (() => { const n = new URLSearchParams(window.location.search).get("next"); return n && n.startsWith("/") && !n.startsWith("//") ? `?returnTo=${encodeURIComponent(n)}` : ""; })()}`}
                  className={cn(
                    "flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-md border",
                    "bg-secondary-foreground/5 border-secondary-foreground/10 text-secondary-foreground",
                    "hover:bg-secondary-foreground/10 transition-colors"
                  )}
                >
                  <svg width="14" height="14" viewBox="0 0 76 65" fill="currentColor"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/></svg>
                  Sign in with Vercel
                </a>
              </>
            )}

            {process.env.NEXT_PUBLIC_ELIZAOS_OAUTH_ENABLED === "true" && (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-secondary-foreground/10" />
                  <span className="text-[10px] text-secondary-foreground/30 uppercase">or</span>
                  <div className="flex-1 h-px bg-secondary-foreground/10" />
                </div>
                <a
                  href={`/api/auth/elizaos/authorize${typeof window !== "undefined" && (() => { const n = new URLSearchParams(window.location.search).get("next"); return n && n.startsWith("/") && !n.startsWith("//") ? `?returnTo=${encodeURIComponent(n)}` : ""; })()}`}
                  className={cn(
                    "flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-md border",
                    "bg-secondary-foreground/5 border-secondary-foreground/10 text-secondary-foreground",
                    "hover:bg-secondary-foreground/10 transition-colors"
                  )}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  Sign in with ElizaOS
                </a>
              </>
            )}

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
