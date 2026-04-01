'use client'

import { useState, useEffect } from "react"

export function DesktopCallbackClient({ token }: { token: string | null }) {
  const [status, setStatus] = useState<"sending" | "done" | "error">(token ? "sending" : "error")

  // Auto-send token to desktop on mount — no button needed
  useEffect(() => {
    if (!token) return

    async function sendToken() {
      try {
        const res = await fetch("/api/auth/desktop-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        })
        setStatus(res.ok ? "done" : "error")
      } catch {
        setStatus("error")
      }
    }

    sendToken()
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#c8d1c0" }}>
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center mb-8 gap-3">
          <img src="/visuals/retro-astro.png" alt="Cadet" className="w-12 h-12" />
          <span className="text-lg font-semibold tracking-wide" style={{ color: "#1C1B1B" }}>
            {status === "done" ? "Authentication Complete" : status === "sending" ? "Authenticating..." : "Authentication Failed"}
          </span>
        </div>

        <div className="p-6" style={{ background: "#F7F5F4", boxShadow: "0 4px 12px rgba(28,27,27,0.06)" }}>
          {status === "done" && (
            <p className="text-sm" style={{ color: "#526258" }}>
              Your session has been sent to the desktop app.<br />
              <strong style={{ color: "#1C1B1B" }}>You can close this tab now.</strong>
            </p>
          )}
          {status === "sending" && (
            <p className="text-sm" style={{ color: "#58413C" }}>
              Sending session to desktop app...
            </p>
          )}
          {status === "error" && (
            <p className="text-sm" style={{ color: "#AA3618" }}>
              {token ? "Failed to send session. Try signing in again." : "No session found. Please sign in first."}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
