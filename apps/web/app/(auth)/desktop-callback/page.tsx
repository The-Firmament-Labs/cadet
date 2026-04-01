import { cookies } from "next/headers"
import { DesktopCallbackClient } from "./client"

/**
 * Desktop Auth Callback (Server Component)
 *
 * Reads the HttpOnly session cookie server-side and passes it
 * to the client component for the token exchange with the desktop app.
 */
export default async function DesktopCallbackPage() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("cadet_session")
  const token = sessionCookie?.value ?? null

  return <DesktopCallbackClient token={token} />
}
