import type {
  AgentManifest,
  AgentScheduleDefinition,
  ControlPlaneTarget
} from "./agent-manifest";

export type ScheduleStatus = "ready" | "claimed";

export const scheduleStatuses: readonly ScheduleStatus[] = ["ready", "claimed"] as const;

export function isScheduleStatus(value: string): value is ScheduleStatus {
  return (scheduleStatuses as readonly string[]).includes(value);
}

export function parseScheduleStatus(value: string, field = "schedule status"): ScheduleStatus {
  if (!isScheduleStatus(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export interface ScheduleRegistration {
  scheduleId: string;
  agentId: string;
  controlPlane: ControlPlaneTarget;
  goal: string;
  intervalMinutes: number;
  priority: AgentScheduleDefinition["priority"];
  enabled: boolean;
  requestedBy: string;
}

export interface RegisteredScheduleRecord extends ScheduleRegistration {
  status: ScheduleStatus;
  nextRunAtMicros: number;
  lastRunAtMicros: number | null;
  lastJobId: string | null;
}

export function scheduleIdForAgent(
  manifest: Pick<AgentManifest, "id">,
  schedule: Pick<AgentScheduleDefinition, "id">
): string {
  return `${manifest.id}_${schedule.id}`;
}

export function schedulesForManifest(manifest: AgentManifest): ScheduleRegistration[] {
  return manifest.schedules.map((schedule) => ({
    scheduleId: scheduleIdForAgent(manifest, schedule),
    agentId: manifest.id,
    controlPlane: manifest.deployment.controlPlane,
    goal: schedule.goal,
    intervalMinutes: schedule.intervalMinutes,
    priority: schedule.priority,
    enabled: schedule.enabled,
    requestedBy: schedule.requestedBy
  }));
}

export function isScheduleDue(
  schedule: Pick<RegisteredScheduleRecord, "enabled" | "nextRunAtMicros">,
  nowMicros = Date.now() * 1_000
): boolean {
  return schedule.enabled && schedule.nextRunAtMicros <= nowMicros;
}
