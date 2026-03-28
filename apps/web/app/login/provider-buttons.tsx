"use client";

import { signIn } from "next-auth/react";

export function ProviderButtons({
  callbackUrl,
  providers
}: {
  callbackUrl: string;
  providers: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="posterActions">
      {providers.map((provider, index) => (
        <button
          key={provider.id}
          className={index === 0 ? "primaryAction" : "secondaryAction"}
          onClick={() => void signIn(provider.id, { callbackUrl })}
          type="button"
        >
          Continue with {provider.name}
        </button>
      ))}
    </div>
  );
}
