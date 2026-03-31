import { getVercelAccessToken } from "./token-store";

/**
 * Create a GitHub PR from sandbox changes.
 * Uses the operator's Vercel access token (which has GitHub scope via OAuth)
 * or a dedicated GITHUB_TOKEN env var.
 */
export async function createPullRequest(opts: {
  operatorId: string;
  repoOwner: string;
  repoName: string;
  baseBranch: string;
  headBranch: string;
  title: string;
  body: string;
}): Promise<{ prUrl: string; prNumber: number } | null> {
  const token = process.env.GITHUB_TOKEN ?? (await getVercelAccessToken(opts.operatorId));
  if (!token) {
    console.warn("[github-pr] No GitHub token available");
    return null;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${opts.repoOwner}/${opts.repoName}/pulls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: opts.title,
          body: opts.body,
          head: opts.headBranch,
          base: opts.baseBranch,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`[github-pr] Failed to create PR: ${res.status} ${text}`);
      return null;
    }

    const data = (await res.json()) as { html_url: string; number: number };
    return { prUrl: data.html_url, prNumber: data.number };
  } catch (error) {
    console.error("[github-pr] Error:", error);
    return null;
  }
}

/**
 * After Claude Code runs in a sandbox with a cloned repo,
 * commit changes and push a branch, then create a PR.
 */
export async function createPrFromSandbox(opts: {
  sandboxId: string;
  vercelAccessToken: string;
  operatorId: string;
  repoUrl: string;
  baseBranch: string;
  goal: string;
  runId: string;
}): Promise<{ prUrl: string; prNumber: number } | null> {
  const { Sandbox } = await import("@vercel/sandbox");

  const credentials = {
    token: opts.vercelAccessToken,
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
  };

  const sandbox = await Sandbox.get({ sandboxId: opts.sandboxId, ...credentials });
  const branchName = `cadet/${opts.runId.slice(0, 12)}`;

  // Check if there are changes to commit
  const statusResult = await sandbox.runCommand("sh", ["-c", "cd /workspace && git status --porcelain"]);
  const status = await statusResult.stdout();

  if (!status.trim()) {
    console.log("[github-pr] No changes to commit in sandbox");
    return null;
  }

  // Commit and push
  await sandbox.runCommand("sh", ["-c", `cd /workspace && git checkout -b ${branchName}`]);
  await sandbox.runCommand("sh", ["-c", `cd /workspace && git add -A && git commit -m "fix: ${opts.goal.slice(0, 72)}"`]);
  await sandbox.runCommand("sh", ["-c", `cd /workspace && git push origin ${branchName}`]);

  // Parse repo owner/name from URL
  const match = opts.repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) {
    console.warn("[github-pr] Could not parse repo URL:", opts.repoUrl);
    return null;
  }

  return createPullRequest({
    operatorId: opts.operatorId,
    repoOwner: match[1]!,
    repoName: match[2]!,
    baseBranch: opts.baseBranch,
    headBranch: branchName,
    title: `fix: ${opts.goal.slice(0, 72)}`,
    body: `## Cadet Agent PR\n\n**Goal:** ${opts.goal}\n**Run:** ${opts.runId}\n**Agent:** Voyager (Claude Code in Vercel Sandbox)\n\n---\n\nThis PR was automatically created by Cadet.`,
  });
}
