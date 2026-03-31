/**
 * Format agent results as rich platform messages.
 * Returns platform-specific formatting when available, falls back to plain text.
 */

export interface RichReply {
  text: string;
  slackBlocks?: unknown[];
}

export function formatRunComplete(opts: {
  runId: string;
  agentId: string;
  goal: string;
  status: string;
  summary?: string;
  prUrl?: string;
  dashboardUrl?: string;
}): RichReply {
  const statusEmoji = opts.status === "completed" ? ":white_check_mark:" : opts.status === "failed" ? ":x:" : ":hourglass:";
  const text = [
    `${statusEmoji} *${opts.agentId}* — ${opts.goal}`,
    opts.summary ? `> ${opts.summary.slice(0, 200)}` : "",
    opts.prUrl ? `:github: <${opts.prUrl}|View PR>` : "",
    opts.dashboardUrl ? `:chart_with_upwards_trend: <${opts.dashboardUrl}|View Run>` : "",
  ].filter(Boolean).join("\n");

  return {
    text,
    slackBlocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `${statusEmoji} *${opts.agentId}* completed` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Goal:* ${opts.goal}` },
      },
      ...(opts.summary ? [{
        type: "section",
        text: { type: "mrkdwn", text: `*Summary:*\n${opts.summary.slice(0, 500)}` },
      }] : []),
      {
        type: "actions",
        elements: [
          ...(opts.prUrl ? [{
            type: "button",
            text: { type: "plain_text", text: "View PR" },
            url: opts.prUrl,
            style: "primary",
          }] : []),
          ...(opts.dashboardUrl ? [{
            type: "button",
            text: { type: "plain_text", text: "View Run" },
            url: opts.dashboardUrl,
          }] : []),
        ],
      },
      { type: "context", elements: [{ type: "mrkdwn", text: `Run: \`${opts.runId}\`` }] },
    ],
  };
}

export function formatApprovalRequest(opts: {
  approvalId: string;
  agentId: string;
  title: string;
  detail: string;
  risk: string;
  dashboardUrl?: string;
}): RichReply {
  const riskEmoji = opts.risk === "high" ? ":rotating_light:" : opts.risk === "medium" ? ":warning:" : ":information_source:";

  return {
    text: `${riskEmoji} *Approval needed* — ${opts.title} (${opts.agentId})`,
    slackBlocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `${riskEmoji} *Approval Required*` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Agent:*\n${opts.agentId}` },
          { type: "mrkdwn", text: `*Risk:*\n${opts.risk}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${opts.title}*\n${opts.detail.slice(0, 300)}` },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            style: "primary",
            action_id: `approve_${opts.approvalId}`,
            value: opts.approvalId,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Reject" },
            style: "danger",
            action_id: `reject_${opts.approvalId}`,
            value: opts.approvalId,
          },
        ],
      },
    ],
  };
}
