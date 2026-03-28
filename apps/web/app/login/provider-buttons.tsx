"use client";

export function ProviderButtons({
  callbackUrl,
  providers,
}: {
  callbackUrl: string;
  providers: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="posterActions">
      <a className="primaryAction" href={`/sign-in?next=${encodeURIComponent(callbackUrl)}`}>
        Sign in with passkey
      </a>
    </div>
  );
}
