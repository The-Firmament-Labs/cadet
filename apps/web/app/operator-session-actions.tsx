"use client";

import { signOut } from "next-auth/react";

export function OperatorSessionActions({
  email
}: {
  email?: string | null | undefined;
}) {
  return (
    <div className="posterActions">
      <span className="secondaryAction">{email ?? "Authenticated operator session"}</span>
      <button
        className="secondaryAction"
        onClick={() => void signOut({ callbackUrl: "/" })}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}
