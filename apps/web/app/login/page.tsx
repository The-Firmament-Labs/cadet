import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getOperatorProviders, getOperatorSession, isOperatorAuthEnabled } from "../../lib/auth";
import { getOperatorAuthConfig } from "../../lib/env";
import { ProviderButtons } from "./provider-buttons";

function firstSearchValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextTarget = firstSearchValue(params.next) ?? "/inbox";
  const authEnabled = isOperatorAuthEnabled();

  if (authEnabled) {
    const session = await getOperatorSession();
    if (session) {
      redirect(nextTarget);
    }
  }

  const authConfig = getOperatorAuthConfig();
  const providers = getOperatorProviders();

  return (
    <main className="cosmosShell">
      <section className="missionPanel">
        <p className="eyebrow">Cadet // Operator Access</p>
        <h1>Authenticate before opening the control plane.</h1>
        <p className="lede">
          The public landing page stays open, but the operator inbox, run detail views, and write-capable
          admin APIs require an authenticated session once OIDC is configured.
        </p>
        {!authEnabled ? (
          <div className="stackList">
            <article className="stackCard">
              <span>Auth not configured</span>
              <strong>Set SpacetimeAuth or Auth0 environment variables to enable operator login.</strong>
              <small>
                Add <code>AUTH_SECRET</code> plus either the <code>SPACETIMEAUTH_*</code> or{" "}
                <code>AUTH0_*</code> values documented in the repository environment section.
              </small>
            </article>
          </div>
        ) : (
          <>
            <ProviderButtons callbackUrl={nextTarget} providers={providers} />
            {authConfig.allowedEmails.length > 0 ? (
              <p className="posterNote">
                Access is restricted to: {authConfig.allowedEmails.join(", ")}
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="missionPanel">
        <p className="eyebrow">Routing</p>
        <div className="stackList">
          <article className="stackCard">
            <span>Protected surfaces</span>
            <strong>/inbox, /runs/[runId], and operator APIs</strong>
            <small>Public docs and the landing page remain readable without a session.</small>
          </article>
          <article className="stackCard">
            <span>Preferred provider</span>
            <strong>SpacetimeAuth first, Auth0 supported</strong>
            <small>
              SpacetimeAuth matches the control plane directly. Auth0 stays available when the team already
              standardizes on it.
            </small>
          </article>
        </div>
        <p className="posterNote">
          <Link href="/">Back to the landing page</Link>
        </p>
      </section>
    </main>
  );
}
