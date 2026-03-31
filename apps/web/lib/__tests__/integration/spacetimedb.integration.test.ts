/**
 * SpacetimeDB Integration Tests
 *
 * These tests validate that our SQL queries and reducer calls
 * work against a real SpacetimeDB instance (or the SDK client).
 *
 * Skip if SPACETIMEDB_URL is not set (CI without SpacetimeDB).
 * Run with: SPACETIMEDB_URL=http://localhost:3000 bun test integration
 */

import { describe, expect, it, beforeAll } from "vitest";

const SPACETIMEDB_URL = process.env.SPACETIMEDB_URL;
const skip = !SPACETIMEDB_URL;

describe.skipIf(skip)("SpacetimeDB Integration", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let client: any;

  beforeAll(async () => {
    const { createControlClient } = await import("../../server");
    client = createControlClient();
  });

  it("can execute a basic SQL query", async () => {
    const rows = await client.sql("SELECT 1 as value");
    expect(rows).toBeDefined();
    expect(Array.isArray(rows)).toBe(true);
  });

  it("can query agent_record table", async () => {
    const rows = await client.sql("SELECT agent_id FROM agent_record LIMIT 1");
    expect(Array.isArray(rows)).toBe(true);
    // May be empty if no agents registered — that's OK
  });

  it("can query workflow_run table", async () => {
    const rows = await client.sql("SELECT run_id, status FROM workflow_run LIMIT 1");
    expect(Array.isArray(rows)).toBe(true);
  });

  it("can query memory_document table", async () => {
    const rows = await client.sql("SELECT document_id, title FROM memory_document LIMIT 1");
    expect(Array.isArray(rows)).toBe(true);
  });

  it("can query thread_record table", async () => {
    const rows = await client.sql("SELECT thread_id FROM thread_record LIMIT 1");
    expect(Array.isArray(rows)).toBe(true);
  });

  it("can query approval_request table", async () => {
    const rows = await client.sql("SELECT approval_id FROM approval_request LIMIT 1");
    expect(Array.isArray(rows)).toBe(true);
  });

  it("can query chat_message table", async () => {
    const rows = await client.sql("SELECT message_id FROM chat_message LIMIT 1");
    expect(Array.isArray(rows)).toBe(true);
  });

  it("can query agent_session table", async () => {
    const rows = await client.sql("SELECT session_id FROM agent_session LIMIT 1");
    expect(Array.isArray(rows)).toBe(true);
  });

  it("can query agent_skill table", async () => {
    const rows = await client.sql("SELECT skill_id FROM agent_skill LIMIT 1");
    expect(Array.isArray(rows)).toBe(true);
  });

  it("can query agent_checkpoint table", async () => {
    const rows = await client.sql("SELECT checkpoint_id FROM agent_checkpoint LIMIT 1");
    expect(Array.isArray(rows)).toBe(true);
  });

  it("can query agent_hook table", async () => {
    const rows = await client.sql("SELECT hook_id FROM agent_hook LIMIT 1");
    expect(Array.isArray(rows)).toBe(true);
  });

  it("can call a reducer (upsert_memory_document) and read back", async () => {
    const testId = `integ_test_${Date.now().toString(36)}`;

    // Write
    await client.callReducer("upsert_memory_document", [
      testId,
      "integration-test",
      "test",
      "Integration Test Doc",
      "This is a test document created by integration tests.",
      "test",
      "{}",
    ]);

    // Read back
    const rows = (await client.sql(
      `SELECT document_id, title, content FROM memory_document WHERE document_id = '${testId}'`,
    )) as Record<string, unknown>[];

    expect(rows.length).toBe(1);
    expect(rows[0]!.document_id).toBe(testId);
    expect(rows[0]!.title).toBe("Integration Test Doc");

    // Cleanup
    await client.callReducer("delete_memory_document", [testId]);
  });

  it("can create and query an agent_session", async () => {
    const sessionId = `integ_ses_${Date.now().toString(36)}`;

    await client.callReducer("create_agent_session", [
      sessionId,
      "integ_operator",
      "claude-code",
      "sandbox_test",
      "https://github.com/test/repo",
      "active",
      Date.now(),
    ]);

    const rows = (await client.sql(
      `SELECT session_id, agent_id, status FROM agent_session WHERE session_id = '${sessionId}'`,
    )) as Record<string, unknown>[];

    expect(rows.length).toBe(1);
    expect(rows[0]!.agent_id).toBe("claude-code");
    expect(rows[0]!.status).toBe("active");

    // Cleanup
    await client.callReducer("update_agent_session_status", [sessionId, "closed", Date.now()]);
  });

  it("can create and query an agent_hook", async () => {
    const hookId = `integ_hook_${Date.now().toString(36)}`;

    await client.callReducer("create_agent_hook", [
      hookId,
      "run:complete",
      "Integration Test Hook",
      "Test hook",
      "console.log('hello')",
      true,
      10,
      "integ_operator",
      Date.now(),
    ]);

    const rows = (await client.sql(
      `SELECT hook_id, event, enabled FROM agent_hook WHERE hook_id = '${hookId}'`,
    )) as Record<string, unknown>[];

    expect(rows.length).toBe(1);
    expect(rows[0]!.event).toBe("run:complete");
    expect(rows[0]!.enabled).toBe(true);

    // Cleanup
    await client.callReducer("delete_agent_hook", [hookId]);
  });

  it("sqlEscape prevents SQL injection", async () => {
    const { sqlEscape } = await import("../../sql");
    const malicious = "'; DROP TABLE agent_record; --";
    const escaped = sqlEscape(malicious);

    // This should NOT throw or drop the table
    const rows = await client.sql(`SELECT 1 as value WHERE '${escaped}' = 'safe'`);
    expect(Array.isArray(rows)).toBe(true);

    // Verify table still exists
    const agents = await client.sql("SELECT COUNT(*) as c FROM agent_record");
    expect(Array.isArray(agents)).toBe(true);
  });
});
