import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import { verifySlackSignature, verifyGitHubSignature } from "../webhook-verify";

const SLACK_SECRET = "test-slack-signing-secret";
const GITHUB_SECRET = "test-github-webhook-secret";

function makeSlackSignature(body: string, timestamp: string, secret = SLACK_SECRET) {
  const baseString = `v0:${timestamp}:${body}`;
  return `v0=${createHmac("sha256", secret).update(baseString).digest("hex")}`;
}

function makeGitHubSignature(body: string, secret = GITHUB_SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifySlackSignature", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, SLACK_SIGNING_SECRET: SLACK_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns true for a valid signature", () => {
    const body = '{"text":"hello"}';
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = makeSlackSignature(body, ts);
    expect(verifySlackSignature(body, ts, sig)).toBe(true);
  });

  it("returns false for a wrong signature", () => {
    const body = '{"text":"hello"}';
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifySlackSignature(body, ts, "v0=wrong")).toBe(false);
  });

  it("returns false for a tampered body", () => {
    const body = '{"text":"hello"}';
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = makeSlackSignature(body, ts);
    expect(verifySlackSignature('{"text":"tampered"}', ts, sig)).toBe(false);
  });

  it("returns false when timestamp is older than 5 minutes", () => {
    const body = '{"text":"hello"}';
    const ts = String(Math.floor(Date.now() / 1000) - 400);
    const sig = makeSlackSignature(body, ts);
    expect(verifySlackSignature(body, ts, sig)).toBe(false);
  });

  it("returns false when SLACK_SIGNING_SECRET is not set", () => {
    delete process.env.SLACK_SIGNING_SECRET;
    const body = "test";
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifySlackSignature(body, ts, "v0=anything")).toBe(false);
  });

  it("returns false for empty signature", () => {
    const body = "test";
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifySlackSignature(body, ts, "")).toBe(false);
  });
});

describe("verifyGitHubSignature", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GITHUB_WEBHOOK_SECRET: GITHUB_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns true for a valid signature", () => {
    const body = '{"action":"opened"}';
    const sig = makeGitHubSignature(body);
    expect(verifyGitHubSignature(body, sig)).toBe(true);
  });

  it("returns false for a wrong signature", () => {
    const body = '{"action":"opened"}';
    expect(verifyGitHubSignature(body, "sha256=wrong")).toBe(false);
  });

  it("returns false for tampered body", () => {
    const body = '{"action":"opened"}';
    const sig = makeGitHubSignature(body);
    expect(verifyGitHubSignature('{"action":"closed"}', sig)).toBe(false);
  });

  it("returns false when GITHUB_WEBHOOK_SECRET is not set", () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    expect(verifyGitHubSignature("test", "sha256=anything")).toBe(false);
  });

  it("returns false for empty signature", () => {
    expect(verifyGitHubSignature("test", "")).toBe(false);
  });
});
