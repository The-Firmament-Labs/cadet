'use client'

import { useState } from "react"
import Link from "next/link"
import { startAuthentication } from "@simplewebauthn/browser"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function SignInPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePasskeySignIn() {
    setLoading(true)
    setError(null)

    try {
      // TODO: Fetch authentication options from /api/auth/login/options
      // const optionsRes = await fetch("/api/auth/login/options", { method: "POST" })
      // const options = await optionsRes.json()

      // TODO: Call startAuthentication with options from the server
      // const credential = await startAuthentication(options)

      // TODO: Send credential to /api/auth/login/verify
      // const verifyRes = await fetch("/api/auth/login/verify", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(credential),
      // })
      // if (!verifyRes.ok) throw new Error("Verification failed")
      // router.push("/dashboard")

      // Suppress unused import warning until API routes are built
      void startAuthentication
      throw new Error("Auth API routes not yet implemented")
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

            <Button
              onClick={handlePasskeySignIn}
              disabled={loading}
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
