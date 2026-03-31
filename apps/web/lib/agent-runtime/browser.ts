/**
 * Cadet Browser Automation
 *
 * Cloud browser sessions for verification, testing, and web interaction.
 * Uses Browserbase for managed cloud browsers — no local Chrome needed.
 *
 * Use cases:
 * - Verify deployed changes work in a real browser
 * - Screenshot pages for visual review
 * - Fill forms and test user flows
 * - Scrape structured data from web pages
 */

export interface BrowserSession {
  sessionId: string;
  connectUrl: string;
  debugUrl: string;
  status: "running" | "completed" | "failed";
}

export interface BrowserAction {
  type: "navigate" | "click" | "type" | "screenshot" | "evaluate" | "wait";
  selector?: string;
  value?: string;
  url?: string;
  script?: string;
  timeout?: number;
}

export interface BrowserResult {
  success: boolean;
  screenshot?: string; // base64
  content?: string;
  error?: string;
  url?: string;
  title?: string;
}

/** Create a Browserbase cloud browser session. */
export async function createBrowserSession(): Promise<BrowserSession> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) throw new Error("BROWSERBASE_API_KEY required for browser automation");

  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!projectId) throw new Error("BROWSERBASE_PROJECT_ID required");

  const res = await fetch("https://api.browserbase.com/v1/sessions", {
    method: "POST",
    headers: {
      "x-bb-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      browserSettings: {
        fingerprint: { devices: ["desktop"], operatingSystems: ["linux"] },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Browserbase session creation failed: ${res.status}`);
  const data = (await res.json()) as { id: string; connectUrl: string; debugUrl?: string; status: string };

  return {
    sessionId: data.id,
    connectUrl: data.connectUrl,
    debugUrl: data.debugUrl ?? "",
    status: "running",
  };
}

/**
 * Execute a browser action using Playwright connected to Browserbase.
 * This runs inside a Vercel Sandbox to avoid adding Playwright as a
 * direct dependency of the web app.
 */
export async function executeBrowserAction(
  sandboxId: string,
  vercelAccessToken: string,
  browserSessionId: string,
  actions: BrowserAction[],
): Promise<BrowserResult[]> {
  const { Sandbox } = await import("@vercel/sandbox");
  const credentials = {
    token: vercelAccessToken,
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
  };

  const sandbox = await Sandbox.get({ sandboxId, ...credentials });

  // Install playwright in the sandbox if needed
  const check = await sandbox.runCommand("sh", ["-c", "node -e 'require(\"playwright\")' 2>/dev/null"]);
  if (check.exitCode !== 0) {
    await sandbox.runCommand("sh", ["-c", "npm install playwright"]);
  }

  // Generate Playwright script from actions
  const script = generatePlaywrightScript(browserSessionId, actions);

  // Write and execute the script
  await sandbox.runCommand("sh", ["-c", `cat > /tmp/browser-action.mjs << 'BROWSER_EOF'\n${script}\nBROWSER_EOF`]);
  const result = await sandbox.runCommand("sh", ["-c", "node /tmp/browser-action.mjs"]);
  const stdout = await result.stdout();

  try {
    return JSON.parse(stdout) as BrowserResult[];
  } catch {
    return [{ success: false, error: stdout || (await result.stderr()) }];
  }
}

function generatePlaywrightScript(sessionId: string, actions: BrowserAction[]): string {
  const connectUrl = `wss://connect.browserbase.com?sessionId=${sessionId}&apiKey=\${process.env.BROWSERBASE_API_KEY}`;

  const actionCode = actions.map((a, i) => {
    switch (a.type) {
      case "navigate":
        return `  await page.goto(${JSON.stringify(a.url ?? "about:blank")}, { waitUntil: 'domcontentloaded', timeout: ${a.timeout ?? 15000} });\n  results.push({ success: true, url: page.url(), title: await page.title() });`;
      case "click":
        return `  await page.click(${JSON.stringify(a.selector ?? "body")}, { timeout: ${a.timeout ?? 5000} });\n  results.push({ success: true });`;
      case "type":
        return `  await page.fill(${JSON.stringify(a.selector ?? "input")}, ${JSON.stringify(a.value ?? "")});\n  results.push({ success: true });`;
      case "screenshot":
        return `  const buf${i} = await page.screenshot({ fullPage: false });\n  results.push({ success: true, screenshot: buf${i}.toString('base64') });`;
      case "evaluate":
        return `  const val${i} = await page.evaluate(() => { ${a.script ?? "return document.title"} });\n  results.push({ success: true, content: String(val${i}) });`;
      case "wait":
        return `  await page.waitForSelector(${JSON.stringify(a.selector ?? "body")}, { timeout: ${a.timeout ?? 10000} });\n  results.push({ success: true });`;
      default:
        return `  results.push({ success: false, error: "Unknown action: ${a.type}" });`;
    }
  }).join("\n");

  return `import { chromium } from 'playwright';
const results = [];
try {
  const browser = await chromium.connectOverCDP(\`${connectUrl}\`);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();
${actionCode}
  await browser.close();
} catch (e) {
  results.push({ success: false, error: e.message });
}
console.log(JSON.stringify(results));`;
}

/** Take a screenshot of a URL for quick verification. */
export async function screenshotUrl(
  url: string,
  sandboxId: string,
  vercelAccessToken: string,
): Promise<string | null> {
  try {
    const session = await createBrowserSession();
    const results = await executeBrowserAction(sandboxId, vercelAccessToken, session.sessionId, [
      { type: "navigate", url },
      { type: "wait", selector: "body", timeout: 5000 },
      { type: "screenshot" },
    ]);

    const screenshotResult = results.find((r) => r.screenshot);
    return screenshotResult?.screenshot ?? null;
  } catch {
    return null;
  }
}
