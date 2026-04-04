/**
 * Tests for apps/web/lib/bot-reply.ts
 *
 * Strategy: mock `./bot` (getBot) and both dynamic imports inside
 * replyToOrigin — `./server` (createControlClient) and `@starbridge/core`
 * (parseMessageChannel).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock: getBot
// ---------------------------------------------------------------------------

const mockBot = {};
vi.mock("./bot", () => ({
  getBot: vi.fn(async () => mockBot),
}));

// Mock ThreadImpl — the new delivery path
const mockPost = vi.fn().mockResolvedValue(undefined);
vi.mock("chat", () => ({
  ThreadImpl: vi.fn().mockImplementation(() => ({
    post: mockPost,
  })),
}));

// ---------------------------------------------------------------------------
// Mock: createControlClient (dynamic import inside replyToOrigin)
// ---------------------------------------------------------------------------

const mockIngestMessage = vi.fn();
const mockControlClient = {
  ingestMessage: mockIngestMessage,
};

vi.mock("./server", () => ({
  createControlClient: vi.fn(() => mockControlClient),
}));

// ---------------------------------------------------------------------------
// Mock: @starbridge/core parseMessageChannel (dynamic import)
// ---------------------------------------------------------------------------

const mockParseMessageChannel = vi.fn((ch: string) => ch);

vi.mock("@starbridge/core", () => ({
  parseMessageChannel: (ch: string) => mockParseMessageChannel(ch),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { replyToOrigin } from "./bot-reply";
import { getBot } from "./bot";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("replyToOrigin – skipped channels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns immediately for channel 'web' without touching any dependency", async () => {
    await replyToOrigin({ channel: "web", channelThreadId: "thread_1", summary: "hello" });

    expect(getBot).not.toHaveBeenCalled();
    expect(mockIngestMessage).not.toHaveBeenCalled();
  });

  it("returns immediately for channel 'system' without touching any dependency", async () => {
    await replyToOrigin({ channel: "system", channelThreadId: "thread_2", summary: "hello" });

    expect(getBot).not.toHaveBeenCalled();
    expect(mockIngestMessage).not.toHaveBeenCalled();
  });
});

describe("replyToOrigin – slack channel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIngestMessage.mockResolvedValue(undefined);
  });

  it("calls getBot and ingestMessage for a slack channel", async () => {
    await replyToOrigin({
      channel: "slack",
      channelThreadId: "C123_1234567890.000",
      summary: "Agent completed the task.",
    });

    expect(getBot).toHaveBeenCalledTimes(1);
    expect(mockIngestMessage).toHaveBeenCalledTimes(1);
  });

  it("passes the correct ingestMessage payload for slack", async () => {
    await replyToOrigin({
      channel: "slack",
      channelThreadId: "C123_1234567890.000",
      summary: "Summary text",
    });

    const call = mockIngestMessage.mock.calls[0]![0];
    expect(call.channel).toBe("slack");
    expect(call.channelThreadId).toBe("C123_1234567890.000");
    expect(call.content).toBe("Summary text");
    expect(call.direction).toBe("outbound");
    expect(call.actor).toBe("cadet");
    expect(call.title).toBe("Agent Reply");
    expect(call.metadata.replyChannel).toBe("slack");
  });

  it("splits channelThreadId on underscore to derive threadId", async () => {
    await replyToOrigin({
      channel: "slack",
      channelThreadId: "C123_1234567890.000",
      summary: "test",
    });

    const call = mockIngestMessage.mock.calls[0]![0];
    expect(call.threadId).toBe("C123");
  });

  it("uses full channelThreadId as threadId when no underscore present", async () => {
    await replyToOrigin({
      channel: "slack",
      channelThreadId: "plainthread",
      summary: "test",
    });

    const call = mockIngestMessage.mock.calls[0]![0];
    expect(call.threadId).toBe("plainthread");
  });

  it("calls parseMessageChannel with the channel string", async () => {
    await replyToOrigin({
      channel: "slack",
      channelThreadId: "C123_456",
      summary: "test",
    });

    expect(mockParseMessageChannel).toHaveBeenCalledWith("slack");
  });
});

describe("replyToOrigin – discord channel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIngestMessage.mockResolvedValue(undefined);
  });

  it("calls ingestMessage for a discord channel", async () => {
    await replyToOrigin({
      channel: "discord",
      channelThreadId: "guild_channel",
      summary: "Discord reply",
    });

    expect(mockIngestMessage).toHaveBeenCalledTimes(1);
    const call = mockIngestMessage.mock.calls[0]![0];
    expect(call.metadata.replyChannel).toBe("discord");
  });
});

describe("replyToOrigin – error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not throw when getBot rejects", async () => {
    vi.mocked(getBot).mockRejectedValueOnce(new Error("bot not configured"));

    await expect(
      replyToOrigin({ channel: "slack", channelThreadId: "C1_456", summary: "test" }),
    ).resolves.toBeUndefined();
  });

  it("does not throw when ingestMessage rejects", async () => {
    mockIngestMessage.mockRejectedValueOnce(new Error("SpacetimeDB write failed"));

    await expect(
      replyToOrigin({ channel: "slack", channelThreadId: "C1_456", summary: "test" }),
    ).resolves.toBeUndefined();
  });

  it("does not throw when ingestMessage throws synchronously", async () => {
    mockIngestMessage.mockImplementationOnce(() => {
      throw new Error("sync error");
    });

    await expect(
      replyToOrigin({ channel: "slack", channelThreadId: "C1_456", summary: "test" }),
    ).resolves.toBeUndefined();
  });
});
