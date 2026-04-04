/**
 * Tests for apps/web/lib/bot-state.ts
 *
 * SpacetimeStateAdapter is tested through its public interface.
 * createControlClient is mocked to avoid real network calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockClient = {
  sql: vi.fn(),
  callReducer: vi.fn(),
};

vi.mock("./server", () => ({
  createControlClient: vi.fn(() => mockClient),
}));

vi.mock("./sql", () => ({
  sqlEscape: vi.fn((s: string) => s.replace(/'/g, "''")),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { SpacetimeStateAdapter } from "./bot-state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Micros timestamp in the past */
const pastMicros = (Date.now() - 120_000) * 1000; // 2 minutes ago

/** Micros timestamp in the future */
const futureMicros = (Date.now() + 120_000) * 1000; // 2 minutes from now

// ---------------------------------------------------------------------------
// KV operations
// ---------------------------------------------------------------------------

describe("SpacetimeStateAdapter – get()", () => {
  let adapter: SpacetimeStateAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SpacetimeStateAdapter();
  });

  it("returns null for missing keys", async () => {
    mockClient.sql.mockResolvedValue([]);
    const result = await adapter.get("missing");
    expect(result).toBeNull();
  });

  it("returns parsed JSON value for existing keys", async () => {
    mockClient.sql.mockResolvedValue([
      { value_json: '{"foo":"bar"}', expires_at_micros: 0 },
    ]);
    const result = await adapter.get("key1");
    expect(result).toEqual({ foo: "bar" });
  });

  it("returns null for expired entries and deletes them", async () => {
    mockClient.sql.mockResolvedValueOnce([
      { value_json: '"stale"', expires_at_micros: pastMicros },
    ]);
    mockClient.callReducer.mockResolvedValue(undefined);

    const result = await adapter.get("expired-key");
    expect(result).toBeNull();
    // delete must be called for the expired key
    expect(mockClient.callReducer).toHaveBeenCalledWith(
      "delete_chat_bot_state",
      ["expired-key"],
    );
  });

  it("returns value for entries with future expiry", async () => {
    mockClient.sql.mockResolvedValue([
      { value_json: '"live"', expires_at_micros: futureMicros },
    ]);
    const result = await adapter.get("live-key");
    expect(result).toBe("live");
  });

  it("returns null when sql throws", async () => {
    mockClient.sql.mockRejectedValue(new Error("connection lost"));
    const result = await adapter.get("err-key");
    expect(result).toBeNull();
  });

  it("treats expires_at_micros=0 as no expiry", async () => {
    mockClient.sql.mockResolvedValue([
      { value_json: "42", expires_at_micros: 0 },
    ]);
    const result = await adapter.get("no-expiry");
    expect(result).toBe(42);
  });
});

describe("SpacetimeStateAdapter – set()", () => {
  let adapter: SpacetimeStateAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SpacetimeStateAdapter();
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("calls upsert_chat_bot_state with key, serialised value, and 'kv'", async () => {
    await adapter.set("key1", { data: 123 }, 5000);
    expect(mockClient.callReducer).toHaveBeenCalledWith(
      "upsert_chat_bot_state",
      expect.arrayContaining(["key1", '{"data":123}', "kv"]),
    );
  });

  it("passes a non-zero expiresAt when ttlMs is provided", async () => {
    await adapter.set("ttl-key", "value", 1000);
    const args = mockClient.callReducer.mock.calls[0]![1] as unknown[];
    const expiresAt = args[3] as number;
    expect(expiresAt).toBeGreaterThan(0);
  });

  it("passes expiresAt=0 when ttlMs is omitted", async () => {
    await adapter.set("no-ttl", "value");
    const args = mockClient.callReducer.mock.calls[0]![1] as unknown[];
    expect(args[3]).toBe(0);
  });

  it("serialises arrays correctly", async () => {
    await adapter.set("arr-key", [1, 2, 3]);
    expect(mockClient.callReducer).toHaveBeenCalledWith(
      "upsert_chat_bot_state",
      expect.arrayContaining(["arr-key", "[1,2,3]", "kv"]),
    );
  });
});

describe("SpacetimeStateAdapter – delete()", () => {
  let adapter: SpacetimeStateAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SpacetimeStateAdapter();
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("calls delete_chat_bot_state with the key", async () => {
    await adapter.delete("key1");
    expect(mockClient.callReducer).toHaveBeenCalledWith(
      "delete_chat_bot_state",
      ["key1"],
    );
  });
});

describe("SpacetimeStateAdapter – setIfNotExists()", () => {
  let adapter: SpacetimeStateAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SpacetimeStateAdapter();
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("returns true and sets when key does not exist", async () => {
    mockClient.sql.mockResolvedValue([]);
    const result = await adapter.setIfNotExists("new-key", "hello");
    expect(result).toBe(true);
    expect(mockClient.callReducer).toHaveBeenCalledWith(
      "upsert_chat_bot_state",
      expect.arrayContaining(["new-key", '"hello"', "kv"]),
    );
  });

  it("returns false and does not overwrite when key exists", async () => {
    mockClient.sql.mockResolvedValue([
      { value_json: '"existing"', expires_at_micros: 0 },
    ]);
    const result = await adapter.setIfNotExists("existing-key", "new-value");
    expect(result).toBe(false);
    expect(mockClient.callReducer).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// List operations
// ---------------------------------------------------------------------------

describe("SpacetimeStateAdapter – list operations", () => {
  let adapter: SpacetimeStateAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SpacetimeStateAdapter();
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("getList returns empty array for missing key", async () => {
    mockClient.sql.mockResolvedValue([]);
    const result = await adapter.getList("thread:empty");
    expect(result).toEqual([]);
  });

  it("getList returns parsed array", async () => {
    mockClient.sql.mockResolvedValue([
      { value_json: '[1,2,3]', expires_at_micros: 0 },
    ]);
    const result = await adapter.getList("thread:1");
    expect(result).toEqual([1, 2, 3]);
  });

  it("appendToList adds an item and persists", async () => {
    // First call (get): empty list
    mockClient.sql.mockResolvedValueOnce([]);
    await adapter.appendToList("thread:1", "msg");

    expect(mockClient.callReducer).toHaveBeenCalledWith(
      "upsert_chat_bot_state",
      expect.arrayContaining(["list:thread:1", '["msg"]', "kv"]),
    );
  });

  it("appendToList trims to maxLength", async () => {
    // Existing list has 3 items
    mockClient.sql.mockResolvedValueOnce([
      { value_json: '["a","b","c"]', expires_at_micros: 0 },
    ]);
    await adapter.appendToList("thread:1", "d", { maxLength: 3 });

    const args = mockClient.callReducer.mock.calls[0]![1] as unknown[];
    const stored = JSON.parse(args[1] as string) as unknown[];
    // Should have kept last 3 from ["a","b","c","d"] → ["b","c","d"]
    expect(stored).toHaveLength(3);
    expect(stored[stored.length - 1]).toBe("d");
  });
});

// ---------------------------------------------------------------------------
// Lock operations
// ---------------------------------------------------------------------------

describe("SpacetimeStateAdapter – acquireLock()", () => {
  let adapter: SpacetimeStateAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SpacetimeStateAdapter();
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("returns a lock object when no lock is held", async () => {
    mockClient.sql.mockResolvedValue([]);
    const lock = await adapter.acquireLock("thread:1", 5000);
    expect(lock).not.toBeNull();
    expect(lock!.threadId).toBe("thread:1");
    expect(typeof lock!.token).toBe("string");
    expect(lock!.token.length).toBeGreaterThan(0);
    expect(lock!.expiresAt).toBeGreaterThan(Date.now());
  });

  it("returns null when a valid lock is already held", async () => {
    const existingLock = {
      threadId: "thread:1",
      token: "held-token",
      expiresAt: Date.now() + 60_000,
    };
    mockClient.sql.mockResolvedValue([
      { value_json: JSON.stringify(existingLock), expires_at_micros: 0 },
    ]);
    const lock = await adapter.acquireLock("thread:1", 5000);
    expect(lock).toBeNull();
  });

  it("allows acquiring a lock when the existing lock has expired", async () => {
    const expiredLock = {
      threadId: "thread:1",
      token: "old-token",
      expiresAt: Date.now() - 1000, // already expired
    };
    mockClient.sql.mockResolvedValue([
      { value_json: JSON.stringify(expiredLock), expires_at_micros: 0 },
    ]);
    const lock = await adapter.acquireLock("thread:1", 5000);
    expect(lock).not.toBeNull();
    expect(lock!.token).not.toBe("old-token");
  });
});

describe("SpacetimeStateAdapter – releaseLock()", () => {
  let adapter: SpacetimeStateAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SpacetimeStateAdapter();
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("deletes the lock key when tokens match", async () => {
    const lock = { threadId: "t1", token: "tok", expiresAt: Date.now() + 5000 };
    mockClient.sql.mockResolvedValue([
      { value_json: JSON.stringify(lock), expires_at_micros: 0 },
    ]);
    await adapter.releaseLock(lock);
    expect(mockClient.callReducer).toHaveBeenCalledWith(
      "delete_chat_bot_state",
      ["lock:t1"],
    );
  });

  it("does not delete when token mismatch", async () => {
    const held = { threadId: "t1", token: "other-tok", expiresAt: Date.now() + 5000 };
    const mine = { threadId: "t1", token: "my-tok", expiresAt: Date.now() + 5000 };
    mockClient.sql.mockResolvedValue([
      { value_json: JSON.stringify(held), expires_at_micros: 0 },
    ]);
    await adapter.releaseLock(mine);
    expect(mockClient.callReducer).not.toHaveBeenCalled();
  });
});

describe("SpacetimeStateAdapter – extendLock()", () => {
  let adapter: SpacetimeStateAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SpacetimeStateAdapter();
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("returns true and updates expiry when token matches", async () => {
    const lock = { threadId: "t1", token: "tok", expiresAt: Date.now() + 1000 };
    mockClient.sql.mockResolvedValue([
      { value_json: JSON.stringify(lock), expires_at_micros: 0 },
    ]);
    const result = await adapter.extendLock(lock, 30_000);
    expect(result).toBe(true);
    expect(mockClient.callReducer).toHaveBeenCalled();
  });

  it("returns false when token does not match", async () => {
    const held = { threadId: "t1", token: "other", expiresAt: Date.now() + 1000 };
    const mine = { threadId: "t1", token: "mine", expiresAt: Date.now() + 1000 };
    mockClient.sql.mockResolvedValue([
      { value_json: JSON.stringify(held), expires_at_micros: 0 },
    ]);
    const result = await adapter.extendLock(mine, 30_000);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Queue operations
// ---------------------------------------------------------------------------

describe("SpacetimeStateAdapter – queue operations", () => {
  let adapter: SpacetimeStateAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SpacetimeStateAdapter();
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("enqueue returns new queue length", async () => {
    mockClient.sql.mockResolvedValue([]); // empty queue
    const entry = { id: "e1", payload: {} } as never;
    const len = await adapter.enqueue("thread:1", entry, 100);
    expect(len).toBe(1);
  });

  it("dequeue returns null for empty queue", async () => {
    mockClient.sql.mockResolvedValue([]);
    const result = await adapter.dequeue("thread:1");
    expect(result).toBeNull();
  });

  it("dequeue returns first item and persists remainder", async () => {
    const q = [{ id: "e1" }, { id: "e2" }];
    mockClient.sql.mockResolvedValueOnce([
      { value_json: JSON.stringify(q), expires_at_micros: 0 },
    ]);
    const entry = await adapter.dequeue("thread:1");
    expect((entry as unknown as { id: string })?.id).toBe("e1");
    // callReducer must be called to persist ["e2"]
    const args = mockClient.callReducer.mock.calls[0]![1] as unknown[];
    expect(JSON.parse(args[1] as string)).toEqual([{ id: "e2" }]);
  });

  it("queueDepth returns 0 for empty queue", async () => {
    mockClient.sql.mockResolvedValue([]);
    const depth = await adapter.queueDepth("thread:1");
    expect(depth).toBe(0);
  });

  it("queueDepth returns correct count", async () => {
    mockClient.sql.mockResolvedValue([
      { value_json: '[1,2,3]', expires_at_micros: 0 },
    ]);
    const depth = await adapter.queueDepth("thread:1");
    expect(depth).toBe(3);
  });

  it("enqueue trims to maxSize", async () => {
    const existingQueue = [{ id: "e1" }, { id: "e2" }];
    mockClient.sql.mockResolvedValueOnce([
      { value_json: JSON.stringify(existingQueue), expires_at_micros: 0 },
    ]);
    const entry = { id: "e3" } as never;
    const len = await adapter.enqueue("thread:1", entry, 2);
    expect(len).toBe(2);
    // persisted queue should have only last 2 entries
    const args = mockClient.callReducer.mock.calls[0]![1] as unknown[];
    const stored = JSON.parse(args[1] as string) as Array<{ id: string }>;
    expect(stored).toHaveLength(2);
    expect(stored[stored.length - 1]!.id).toBe("e3");
  });
});

// ---------------------------------------------------------------------------
// Subscription operations
// ---------------------------------------------------------------------------

describe("SpacetimeStateAdapter – subscribe / unsubscribe / isSubscribed", () => {
  let adapter: SpacetimeStateAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SpacetimeStateAdapter();
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("subscribe calls upsert_chat_bot_state with sub: key and 'subscription' type", async () => {
    await adapter.subscribe("thread:123");
    expect(mockClient.callReducer).toHaveBeenCalledWith(
      "upsert_chat_bot_state",
      expect.arrayContaining(["sub:thread:123", "true", "subscription"]),
    );
  });

  it("unsubscribe calls delete_chat_bot_state with sub: key", async () => {
    await adapter.unsubscribe("thread:123");
    expect(mockClient.callReducer).toHaveBeenCalledWith(
      "delete_chat_bot_state",
      ["sub:thread:123"],
    );
  });

  it("isSubscribed returns true when subscription row exists", async () => {
    mockClient.sql.mockResolvedValue([{ key: "sub:thread:123" }]);
    const result = await adapter.isSubscribed("thread:123");
    expect(result).toBe(true);
  });

  it("isSubscribed returns false for missing subscriptions", async () => {
    mockClient.sql.mockResolvedValue([]);
    const result = await adapter.isSubscribed("thread:404");
    expect(result).toBe(false);
  });

  it("isSubscribed returns false when sql throws", async () => {
    mockClient.sql.mockRejectedValue(new Error("db error"));
    const result = await adapter.isSubscribed("thread:err");
    expect(result).toBe(false);
  });
});
