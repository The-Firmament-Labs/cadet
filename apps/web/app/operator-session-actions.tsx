"use client";

import React from "react";

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
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/";
        }}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}
