export interface ServerEnv {
  controlPlaneUrl: string;
  spacetimeUrl: string;
  database: string;
  authToken?: string | undefined;
  cronSecret?: string | undefined;
}

export interface SafeServerEnv {
  controlPlaneUrl: string;
  spacetimeUrl: string;
  database: string;
  hasAuthToken: boolean;
  hasCronSecret: boolean;
  hasSpacetimeConfig: boolean;
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
    cronSecret: trimEnvValue(source.CRON_SECRET)
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
    hasSpacetimeConfig: hasSpacetimeConfig(source)
  };
}

export function requireSpacetimeServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  if (isVercelRuntime(source) && !hasSpacetimeConfig(source)) {
    throw new Error(
      "Missing SPACETIMEDB_URL or SPACETIMEDB_DATABASE in the Vercel runtime environment"
    );
  }

  return getServerEnv(source);
}
