'use client'

import { useState } from "react"

export function DesktopCallbackClient({ token }: { token: string | null }) {
  const [returned, setReturned] = useState(false)

  async function handleReturn() {
    if (!token) return
    setReturned(true)

    try {
      await fetch("/api/auth/desktop-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
    } catch { /* best-effort */ }

    setTimeout(() => window.close(), 1000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#c8d1c0" }}>
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center mb-8 gap-3">
          <img src="/visuals/retro-astro.png" alt="Cadet" className="w-12 h-12" />
          <span className="text-lg font-semibold tracking-wide" style={{ color: "#1C1B1B" }}>
            Authentication Complete
          </span>
        </div>

        <div className="p-6" style={{ background: "#F7F5F4", boxShadow: "0 4px 12px rgba(28,27,27,0.06)" }}>
          {token ? (
            <>
              <p className="text-sm mb-4" style={{ color: "#58413C" }}>
                {returned
                  ? "Returning to the desktop app..."
                  : "You've been authenticated. Click below to return to the desktop app."}
              </p>
              <button
                onClick={handleReturn}
                disabled={returned}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white cursor-pointer border-none"
                style={{ background: returned ? "#5F5E5E" : "#AA3618" }}
              >
                {returned ? "Returning..." : "Return to Cadet Desktop"}
              </button>
            </>
          ) : (
            <p className="text-sm" style={{ color: "#58413C" }}>
              No session found. Please sign in first.
            </p>
          )}
        </div>

        <p className="mt-4 text-xs" style={{ color: "#58413C", opacity: 0.5 }}>
          This window will close automatically.
        </p>
      </div>
    </div>
  )
}
