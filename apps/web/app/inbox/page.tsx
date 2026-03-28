import { parseApprovalStatus } from "@starbridge/core";
import Link from "next/link";

import {
  getOperatorSpacetimeToken,
  requireOperatorPageSession
} from "../../lib/auth";
import { loadInbox } from "../../lib/server";
import { OperatorSessionActions } from "../operator-session-actions";

export const dynamic = "force-dynamic";
const pendingApprovalStatus = parseApprovalStatus("pending");

export default async function InboxPage() {
  const session = await requireOperatorPageSession("/inbox");
  const inbox = await loadInbox(getOperatorSpacetimeToken(session)).catch(() => ({
    threads: [],
    runs: [],
    approvals: [],
    browserTasks: []
  }));

  return (
    <main className="cosmosShell">
      <section className="missionPanel">
        <p className="eyebrow">Cadet // Operator Inbox</p>
        <h1>Runs, approvals, and browser work in one queue.</h1>
        <p className="lede">
          Every inbound event becomes a durable thread, workflow run, and step graph in SpacetimeDB.
        </p>
        {session ? <OperatorSessionActions email={session.email} /> : null}
        <div className="metricGrid">
          <article className="metricCard">
            <span>Threads</span>
            <strong>{inbox.threads.length}</strong>
          </article>
          <article className="metricCard">
            <span>Runs</span>
            <strong>{inbox.runs.length}</strong>
          </article>
          <article className="metricCard">
            <span>Pending approvals</span>
            <strong>
              {inbox.approvals.filter((item) => item.status === pendingApprovalStatus).length}
            </strong>
          </article>
          <article className="metricCard">
            <span>Browser tasks</span>
            <strong>{inbox.browserTasks.length}</strong>
          </article>
        </div>
      </section>

      <section className="missionPanel">
        <p className="eyebrow">Workflow Runs</p>
        <div className="stackList">
          {inbox.runs.length === 0 ? (
            <div className="stackCard">
              <strong>No workflow runs loaded.</strong>
              <small>Start SpacetimeDB and the control planes to populate the inbox.</small>
            </div>
          ) : (
            inbox.runs.map((run) => (
              <Link key={run.runId} href={`/runs/${run.runId}`} className="stackCard">
                <span>{run.agentId}</span>
                <strong>{run.goal}</strong>
                <small>
                  {run.status} · {run.currentStage}
                </small>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="missionPanel">
        <p className="eyebrow">Approvals</p>
        <div className="stackList">
          {inbox.approvals.length === 0 ? (
            <div className="stackCard">
              <strong>No active approval gates.</strong>
              <small>Low-risk browsing and triage are still autonomous.</small>
            </div>
          ) : (
            inbox.approvals.map((approval) => (
              <div key={approval.approvalId} className="stackCard">
                <span>{approval.risk}</span>
                <strong>{approval.title}</strong>
                <small>{approval.status}</small>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
