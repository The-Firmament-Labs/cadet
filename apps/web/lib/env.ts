export interface ServerEnv {
  controlPlaneUrl: string;
  spacetimeUrl: string;
  database: string;
  authToken?: string | undefined;
  cronSecret?: string | undefined;
  vercelClientId?: string | undefined;
  vercelClientSecret?: string | undefined;
  queuesEnabled: boolean;
  workflowEnabled: boolean;
  sandboxDefaultTemplate?: string | undefined;
  sandboxIdleTimeoutMs: number;
  sandboxMaxPerOperator: number;
}

export interface OperatorAuthProviderConfig {
  id: "spacetimeauth" | "auth0";
  name: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  domain?: string | undefined;
}

export interface OperatorAuthConfig {
  enabled: boolean;
  secret?: string | undefined;
  allowedEmails: string[];
  providers: OperatorAuthProviderConfig[];
}

export interface SafeServerEnv {
  controlPlaneUrl: string;
  spacetimeUrl: string;
  database: string;
  hasAuthToken: boolean;
  hasCronSecret: boolean;
  hasSpacetimeConfig: boolean;
  hasOperatorAuth: boolean;
  hasVercelOAuth: boolean;
  queuesEnabled: boolean;
  workflowEnabled: boolean;
}

function trimEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeUrlValue(value: string | undefined): string | undefined {
  const trimmed = trimEnvValue(value);
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function parseEmailList(value: string | undefined): string[] {
  const trimmed = trimEnvValue(value);
  if (!trimmed) {
    return [];
  }

  return [
    ...new Set(
      trimmed
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0)
    )
  ];
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isVercelRuntime(source: NodeJS.ProcessEnv): boolean {
  return Boolean(
    trimEnvValue(source.VERCEL) ??
      trimEnvValue(source.VERCEL_ENV) ??
      trimEnvValue(source.VERCEL_URL)
  );
}

export function hasSpacetimeConfig(source: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    trimEnvValue(source.SPACETIMEDB_URL) && trimEnvValue(source.SPACETIMEDB_DATABASE)
  );
}

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const controlPlaneUrl =
    normalizeUrlValue(source.NEXT_PUBLIC_CONTROL_PLANE_URL) ??
    normalizeUrlValue(source.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeUrlValue(source.VERCEL_URL) ??
    "http://localhost:3001";

  return {
    controlPlaneUrl,
    spacetimeUrl: trimEnvValue(source.SPACETIMEDB_URL) ?? "http://127.0.0.1:3000",
    database: trimEnvValue(source.SPACETIMEDB_DATABASE) ?? "starbridge-control",
    authToken: trimEnvValue(source.SPACETIMEDB_AUTH_TOKEN),
    cronSecret: trimEnvValue(source.CRON_SECRET),
    vercelClientId: trimEnvValue(source.VERCEL_INTEGRATION_CLIENT_ID),
    vercelClientSecret: trimEnvValue(source.VERCEL_INTEGRATION_CLIENT_SECRET),
    queuesEnabled: trimEnvValue(source.VERCEL_QUEUES_ENABLED) === "true",
    workflowEnabled: trimEnvValue(source.WORKFLOW_ENABLED) === "true",
    sandboxDefaultTemplate: trimEnvValue(source.SANDBOX_DEFAULT_TEMPLATE),
    sandboxIdleTimeoutMs: parseInt(trimEnvValue(source.SANDBOX_IDLE_TIMEOUT_MS) ?? "300000", 10),
    sandboxMaxPerOperator: parseInt(trimEnvValue(source.SANDBOX_MAX_PER_OPERATOR) ?? "5", 10),
  };
}

export function getSafeServerEnv(source: NodeJS.ProcessEnv = process.env): SafeServerEnv {
  const env = getServerEnv(source);

  return {
    controlPlaneUrl: env.controlPlaneUrl,
    spacetimeUrl: env.spacetimeUrl,
    database: env.database,
    hasAuthToken: Boolean(env.authToken),
    hasCronSecret: Boolean(env.cronSecret),
    hasSpacetimeConfig: hasSpacetimeConfig(source),
    hasOperatorAuth: hasOperatorAuth(source),
    hasVercelOAuth: Boolean(env.vercelClientId && env.vercelClientSecret),
    queuesEnabled: env.queuesEnabled,
    workflowEnabled: env.workflowEnabled,
  };
}

export function getOperatorAuthConfig(
  source: NodeJS.ProcessEnv = process.env
): OperatorAuthConfig {
  const providers: OperatorAuthProviderConfig[] = [];

  const spacetimeClientId = trimEnvValue(source.SPACETIMEAUTH_CLIENT_ID);
  const spacetimeClientSecret = trimEnvValue(source.SPACETIMEAUTH_CLIENT_SECRET);
  if (spacetimeClientId && spacetimeClientSecret) {
    providers.push({
      id: "spacetimeauth",
      name: "SpacetimeAuth",
      issuer: trimTrailingSlash(
        normalizeUrlValue(source.SPACETIMEAUTH_ISSUER) ?? "https://auth.spacetimedb.com/oidc"
      ),
      clientId: spacetimeClientId,
      clientSecret: spacetimeClientSecret
    });
  }

  const auth0Domain = trimEnvValue(source.AUTH0_DOMAIN);
  const auth0ClientId = trimEnvValue(source.AUTH0_CLIENT_ID);
  const auth0ClientSecret = trimEnvValue(source.AUTH0_CLIENT_SECRET);
  if (auth0Domain && auth0ClientId && auth0ClientSecret) {
    const normalizedDomain = trimTrailingSlash(auth0Domain.replace(/^https?:\/\//, ""));
    providers.push({
      id: "auth0",
      name: "Auth0",
      issuer: `https://${normalizedDomain}/`,
      domain: normalizedDomain,
      clientId: auth0ClientId,
      clientSecret: auth0ClientSecret
    });
  }

  return {
    enabled: providers.length > 0,
    secret: trimEnvValue(source.AUTH_SECRET),
    allowedEmails: parseEmailList(source.OPERATOR_AUTH_ALLOWED_EMAILS),
    providers
  };
}

export function hasOperatorAuth(source: NodeJS.ProcessEnv = process.env): boolean {
  return getOperatorAuthConfig(source).enabled;
}

export function isOperatorEmailAllowed(
  allowedEmails: readonly string[],
  email: string | null | undefined
): boolean {
  if (allowedEmails.length === 0) {
    return true;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  return allowedEmails.includes(normalizedEmail);
}

export function requireSpacetimeServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (isVercelRuntime(source) && !hasSpacetimeConfig(source)) {
    throw new Error(
      "Missing SPACETIMEDB_URL or SPACETIMEDB_DATABASE in the Vercel runtime environment"
    );
  }

  return getServerEnv(source);
}
