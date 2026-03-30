export type SandboxStatus = "creating" | "running" | "sleeping" | "stopped" | "error";

export interface SandboxRecord {
  sandboxId: string;
  operatorId: string;
  agentId: string;
  runId?: string;
  snapshotId?: string;
  status: SandboxStatus;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

export interface SandboxSnapshot {
  snapshotId: string;
  sandboxId: string;
  operatorId: string;
  createdAt: number;
}
