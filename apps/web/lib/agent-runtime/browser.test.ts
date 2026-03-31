import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mock variables ────────────────────────────────────────────
const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

const mockRunCommand = vi.hoisted(() => vi.fn());
const mockSandboxGet = vi.hoisted(() => vi.fn());

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    get: mockSandboxGet,
  },
}));

import {
  createBrowserSession,
  executeBrowserAction,
  screenshotUrl,
  type BrowserAction,
} from "./browser";

// ── Helpers ───────────────────────────────────────────────────────────

function makeSandboxStub(stdoutValue = "[]") {
  const mockStdout = vi.fn().mockResolvedValue(stdoutValue);
  const mockStderr = vi.fn().mockResolvedValue("");

  mockRunCommand.mockResolvedValue({
    exitCode: 0,
    stdout: mockStdout,
    stderr: mockStderr,
  });

  mockSandboxGet.mockResolvedValue({ runCommand: mockRunCommand });

  return { mockStdout, mockStderr };
}

function mockBrowserbaseSessionResponse(id = "bb_session_1") {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: vi.fn().mockResolvedValue({
      id,
      connectUrl: `wss://connect.browserbase.com?sessionId=${id}`,
      debugUrl: `https://debug.browserbase.com/${id}`,
      status: "running",
    }),
  });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BROWSERBASE_API_KEY = "bb_api_key";
  process.env.BROWSERBASE_PROJECT_ID = "bb_proj_id";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ── createBrowserSession ──────────────────────────────────────────────

describe("createBrowserSession", () => {
  it("calls Browserbase API with correct URL and method", async () => {
    mockBrowserbaseSessionResponse();

    await createBrowserSession();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.browserbase.com/v1/sessions");
    expect(opts.method).toBe("POST");
  });

  it("sends API key header", async () => {
    mockBrowserbaseSessionResponse();

    await createBrowserSession();

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers["x-bb-api-key"]).toBe("bb_api_key");
  });

  it("sends projectId in request body", async () => {
    mockBrowserbaseSessionResponse();

    await createBrowserSession();

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.projectId).toBe("bb_proj_id");
  });

  it("returns a BrowserSession with correct shape", async () => {
    mockBrowserbaseSessionResponse("bb_sess_xyz");

    const session = await createBrowserSession();

    expect(session.sessionId).toBe("bb_sess_xyz");
    expect(session.connectUrl).toContain("bb_sess_xyz");
    expect(session.debugUrl).toBeTruthy();
    expect(session.status).toBe("running");
  });

  it("defaults debugUrl to empty string when missing from response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: "bb_no_debug",
        connectUrl: "wss://connect",
        status: "running",
        // no debugUrl
      }),
    });

    const session = await createBrowserSession();
    expect(session.debugUrl).toBe("");
  });

  it("throws without BROWSERBASE_API_KEY", async () => {
    delete process.env.BROWSERBASE_API_KEY;

    await expect(createBrowserSession()).rejects.toThrow("BROWSERBASE_API_KEY required");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws without BROWSERBASE_PROJECT_ID", async () => {
    delete process.env.BROWSERBASE_PROJECT_ID;

    await expect(createBrowserSession()).rejects.toThrow("BROWSERBASE_PROJECT_ID required");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when Browserbase API returns error status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(createBrowserSession()).rejects.toThrow(
      "Browserbase session creation failed: 403"
    );
  });
});

// ── executeBrowserAction / generatePlaywrightScript ───────────────────

describe("executeBrowserAction", () => {
  it("calls Sandbox.get with sandboxId and credentials", async () => {
    makeSandboxStub('[{"success":true}]');

    await executeBrowserAction("sb_1", "tok_access", "bb_sess_1", [
      { type: "screenshot" },
    ]);

    expect(mockSandboxGet).toHaveBeenCalledOnce();
    const arg = mockSandboxGet.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.sandboxId).toBe("sb_1");
    expect(arg.token).toBe("tok_access");
  });

  it("generates navigate action with correct URL in script", async () => {
    const results: Array<Record<string, unknown>> = [];
    const mockStdout = vi.fn();
    mockRunCommand.mockImplementation(async (_cmd: string, args: string[]) => {
      // Capture the script written via cat heredoc
      const scriptArg = args.join(" ");
      if (scriptArg.includes("browser-action.mjs")) {
        // Return script write success
      }
      // For the node execution, return our results
      return {
        exitCode: 0,
        stdout: mockStdout.mockResolvedValue(JSON.stringify([{ success: true, url: "https://example.com", title: "Example" }])),
        stderr: vi.fn().mockResolvedValue(""),
      };
    });
    mockSandboxGet.mockResolvedValue({ runCommand: mockRunCommand });

    const actions: BrowserAction[] = [{ type: "navigate", url: "https://example.com" }];
    const output = await executeBrowserAction("sb_1", "tok", "bb_sess_1", actions);

    // Find the call that writes the script (contains the script content)
    const writeCall = mockRunCommand.mock.calls.find(
      (c: string[][]) => c[1]?.some?.((a: string) => a.includes("page.goto"))
    );
    expect(writeCall).toBeDefined();
    expect(writeCall![1].join(" ")).toContain("https://example.com");
  });

  it("generates click action with selector in script", async () => {
    makeSandboxStub('[{"success":true}]');

    const actions: BrowserAction[] = [{ type: "click", selector: "#submit-btn" }];
    await executeBrowserAction("sb_1", "tok", "bb_sess_1", actions);

    const writeCall = mockRunCommand.mock.calls.find(
      (c: string[][]) => c[1]?.some?.((a: string) => a.includes("page.click"))
    );
    expect(writeCall).toBeDefined();
    expect(writeCall![1].join(" ")).toContain("#submit-btn");
  });

  it("generates type action with value in script", async () => {
    makeSandboxStub('[{"success":true}]');

    const actions: BrowserAction[] = [
      { type: "type", selector: "input[name=email]", value: "test@example.com" },
    ];
    await executeBrowserAction("sb_1", "tok", "bb_sess_1", actions);

    const writeCall = mockRunCommand.mock.calls.find(
      (c: string[][]) => c[1]?.some?.((a: string) => a.includes("page.fill"))
    );
    expect(writeCall).toBeDefined();
    const script = writeCall![1].join(" ");
    expect(script).toContain("input[name=email]");
    expect(script).toContain("test@example.com");
  });

  it("generates screenshot action in script", async () => {
    makeSandboxStub('[{"success":true,"screenshot":"base64data"}]');

    const actions: BrowserAction[] = [{ type: "screenshot" }];
    await executeBrowserAction("sb_1", "tok", "bb_sess_1", actions);

    const writeCall = mockRunCommand.mock.calls.find(
      (c: string[][]) => c[1]?.some?.((a: string) => a.includes("page.screenshot"))
    );
    expect(writeCall).toBeDefined();
  });

  it("generates evaluate action with script in script", async () => {
    makeSandboxStub('[{"success":true,"content":"doc-title"}]');

    const actions: BrowserAction[] = [
      { type: "evaluate", script: "return document.title" },
    ];
    await executeBrowserAction("sb_1", "tok", "bb_sess_1", actions);

    const writeCall = mockRunCommand.mock.calls.find(
      (c: string[][]) => c[1]?.some?.((a: string) => a.includes("page.evaluate"))
    );
    expect(writeCall).toBeDefined();
  });

  it("generates wait action with selector in script", async () => {
    makeSandboxStub('[{"success":true}]');

    const actions: BrowserAction[] = [
      { type: "wait", selector: ".loaded", timeout: 3000 },
    ];
    await executeBrowserAction("sb_1", "tok", "bb_sess_1", actions);

    const writeCall = mockRunCommand.mock.calls.find(
      (c: string[][]) => c[1]?.some?.((a: string) => a.includes("page.waitForSelector"))
    );
    expect(writeCall).toBeDefined();
    expect(writeCall![1].join(" ")).toContain(".loaded");
  });

  it("parses JSON stdout results", async () => {
    const expectedResults = [{ success: true, url: "https://example.com" }];
    makeSandboxStub(JSON.stringify(expectedResults));

    const results = await executeBrowserAction("sb_1", "tok", "bb_sess_1", [
      { type: "navigate", url: "https://example.com" },
    ]);

    expect(results).toEqual(expectedResults);
  });

  it("returns error result when stdout is not valid JSON", async () => {
    const mockStdout = vi.fn().mockResolvedValue("not json output");
    const mockStderr = vi.fn().mockResolvedValue("some error");
    mockRunCommand.mockResolvedValue({
      exitCode: 0,
      stdout: mockStdout,
      stderr: mockStderr,
    });
    mockSandboxGet.mockResolvedValue({ runCommand: mockRunCommand });

    const results = await executeBrowserAction("sb_1", "tok", "bb_sess_1", [
      { type: "screenshot" },
    ]);

    expect(results[0]!.success).toBe(false);
    expect(results[0]!.error).toBeTruthy();
  });

  it("installs playwright in sandbox when not present", async () => {
    // First runCommand (check) exits with code 1 (not installed)
    mockRunCommand
      .mockResolvedValueOnce({ exitCode: 1, stdout: vi.fn().mockResolvedValue(""), stderr: vi.fn().mockResolvedValue("") })
      .mockResolvedValue({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue('[{"success":true}]'),
        stderr: vi.fn().mockResolvedValue(""),
      });
    mockSandboxGet.mockResolvedValue({ runCommand: mockRunCommand });

    await executeBrowserAction("sb_1", "tok", "bb_sess_1", [{ type: "screenshot" }]);

    const installCall = mockRunCommand.mock.calls.find(
      (c: string[][]) => c[1]?.some?.((a: string) => a.includes("npm install playwright"))
    );
    expect(installCall).toBeDefined();
  });
});

// ── screenshotUrl ─────────────────────────────────────────────────────

describe("screenshotUrl", () => {
  it("creates a browser session before navigating", async () => {
    mockBrowserbaseSessionResponse("bb_screenshot_sess");
    makeSandboxStub(JSON.stringify([
      { success: true, url: "https://target.com" },
      { success: true },
      { success: true, screenshot: "base64screenshot" },
    ]));

    await screenshotUrl("https://target.com", "sb_1", "tok");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0]! as [string];
    expect(url).toBe("https://api.browserbase.com/v1/sessions");
  });

  it("returns screenshot base64 string on success", async () => {
    mockBrowserbaseSessionResponse();
    makeSandboxStub(JSON.stringify([
      { success: true },
      { success: true },
      { success: true, screenshot: "iVBORw0KGgo=" },
    ]));

    const screenshot = await screenshotUrl("https://target.com", "sb_1", "tok");
    expect(screenshot).toBe("iVBORw0KGgo=");
  });

  it("returns null when an error occurs", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));

    const screenshot = await screenshotUrl("https://bad.com", "sb_1", "tok");
    expect(screenshot).toBeNull();
  });

  it("returns null when no screenshot result found", async () => {
    mockBrowserbaseSessionResponse();
    makeSandboxStub(JSON.stringify([
      { success: true },
      { success: true },
      // no screenshot field
      { success: true },
    ]));

    const screenshot = await screenshotUrl("https://target.com", "sb_1", "tok");
    expect(screenshot).toBeNull();
  });
});
