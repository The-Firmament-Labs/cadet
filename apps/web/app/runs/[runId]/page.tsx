import React from "react";
import Link from "next/link";

import {
  getOperatorSpacetimeToken,
  requireOperatorPageSession
} from "../../../lib/auth";
import { loadRunDetails } from "../../../lib/server";
import { OperatorSessionActions } from "../../operator-session-actions";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const session = await requireOperatorPageSession(`/runs/${runId}`);
  const detail = await loadRunDetails(
    runId,
    getOperatorSpacetimeToken(session)
  ).catch(() => null);

  if (!detail) {
    return (
      <main className="cosmosShell">
        <section className="missionPanel">
          <p className="eyebrow">Cadet // Workflow Run</p>
          <h1>Run unavailable.</h1>
          <p className="lede">
            The run could not be loaded. Confirm SpacetimeDB is reachable and the run still exists.
          </p>
          <p>
            <Link href="/inbox">Back to inbox</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="cosmosShell">
      <section className="missionPanel">
        <p className="eyebrow">Cadet // Workflow Run</p>
        <h1>{detail.run.goal}</h1>
        <p className="lede">
          {detail.run.agentId} · {detail.run.status} · {detail.run.currentStage}
        </p>
        {session ? <OperatorSessionActions email={session.email} /> : null}
        <p>
          <Link href="/inbox">Back to inbox</Link>
        </p>
      </section>

      <section className="missionPanel">
        <p className="eyebrow">Stages</p>
        <div className="stackList">
          {detail.steps.map((step) => (
            <article key={step.stepId} className="stackCard">
              <span>{step.ownerExecution}</span>
              <strong>{step.stage}</strong>
              <small>{step.status}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="missionPanel">
        <p className="eyebrow">Job</p>
        <div className="stackList">
          {!detail.job ? (
            <div className="stackCard">
              <strong>No linked job record found.</strong>
            </div>
          ) : (
            <article className="stackCard">
              <span>{detail.job.priority}</span>
              <strong>{detail.job.jobId}</strong>
              <small>{detail.job.status}</small>
              {detail.job.resultSummary ? <p>{detail.job.resultSummary}</p> : null}
            </article>
          )}
        </div>
      </section>

      <section className="missionPanel">
        <p className="eyebrow">Tool Calls</p>
        <div className="stackList">
          {detail.toolCalls.length === 0 ? (
            <div className="stackCard">
              <strong>No tool calls recorded yet.</strong>
            </div>
          ) : (
            detail.toolCalls.map((toolCall) => (
              <article key={toolCall.toolCallId} className="stackCard">
                <span>{toolCall.status}</span>
                <strong>{toolCall.toolName}</strong>
                <small>{toolCall.toolCallId}</small>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="missionPanel">
        <p className="eyebrow">Browser Artifacts</p>
        <div className="stackList">
          {detail.browserArtifacts.length === 0 ? (
            <div className="stackCard">
              <strong>No browser artifacts recorded yet.</strong>
            </div>
          ) : (
            detail.browserArtifacts.map((artifact) => (
              <article key={artifact.artifactId} className="stackCard">
                <span>{artifact.kind}</span>
                <strong>{artifact.title}</strong>
                <small>{artifact.url}</small>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
