import { createControlClient } from "./server";

// ---------------------------------------------------------------------------
// Approval types
// ---------------------------------------------------------------------------

export interface ApprovalResult {
  approved: boolean;
  comment?: string;
  operatorId: string;
}

// ---------------------------------------------------------------------------
// SpacetimeDB approval bridge
// ---------------------------------------------------------------------------

/**
 * Create an approval request in SpacetimeDB.
 * Returns the approvalId which serves as the hook token for workflow resumption.
 */
export async function createApprovalRequest(opts: {
  runId: string;
  agentId: string;
  stepName: string;
  context: string;
}): Promise<string> {
  const client = createControlClient();
  const approvalId = crypto.randomUUID();
  await client.callReducer("create_approval", [
    approvalId,
    opts.runId,
    opts.agentId,
    opts.stepName,
    opts.context,
    "pending",
    "medium",
    Date.now(),
  ]);
  return approvalId;
}

/**
 * Record an approval resolution in SpacetimeDB.
 */
export async function resolveApprovalRecord(
  approvalId: string,
  result: ApprovalResult,
): Promise<void> {
  const client = createControlClient();
  const status = result.approved ? "approved" : "rejected";
  await client.callReducer("resolve_approval", [
    approvalId,
    status,
    result.operatorId,
    result.comment ?? "",
    Date.now(),
  ]);
}
