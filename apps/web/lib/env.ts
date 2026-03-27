export interface ServerEnv {
  controlPlaneUrl: string;
  spacetimeUrl: string;
  database: string;
  authToken?: string | undefined;
  cronSecret?: string | undefined;
}

export function getServerEnv(): ServerEnv {
  return {
    controlPlaneUrl: process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ?? "http://localhost:3001",
    spacetimeUrl: process.env.SPACETIMEDB_URL ?? "http://127.0.0.1:3000",
    database: process.env.SPACETIMEDB_DATABASE ?? "starbridge-control",
    authToken: process.env.SPACETIMEDB_AUTH_TOKEN,
    cronSecret: process.env.CRON_SECRET
  };
}
