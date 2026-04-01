'use client'

import { useEffect, useState } from "react"

/**
 * Desktop Auth Callback
 *
 * After WebAuthn authentication succeeds, the sign-in/sign-up pages
 * redirect here when ?desktop=true was set. This page:
 * 1. Reads the cadet_session cookie
 * 2. Displays a "Return to Cadet" button
 * 3. Navigates to cadet://auth-complete?token=xxx which the desktop
 *    WebView intercepts to extract the token and close the window
 */
export default function DesktopCallbackPage() {
  const [token, setToken] = useState<string | null>(null)
  const [returned, setReturned] = useState(false)

  useEffect(() => {
    // Extract the session cookie
    const match = document.cookie.match(/cadet_session=([^;]+)/)
    if (match?.[1]) {
      setToken(match[1])
    }
  }, [])

  async function handleReturn() {
    if (!token) return
    setReturned(true)

    // Write the token to a server endpoint that saves it to a file
    // the desktop app can read. Then close this tab.
    try {
      await fetch("/api/auth/desktop-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
    } catch { /* best-effort */ }

    // Show "you can close this tab" message
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
