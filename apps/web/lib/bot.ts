/**
 * Cadet Chat SDK Bot
 *
 * Unified multi-platform bot backed by the Vercel Chat SDK.
 * Adapters are conditionally enabled based on environment variables.
 *
 * Supported platforms:
 * - Slack (SLACK_BOT_TOKEN)
 * - Discord (DISCORD_BOT_TOKEN + DISCORD_PUBLIC_KEY + DISCORD_APPLICATION_ID)
 * - GitHub (GITHUB_BOT_TOKEN or GitHub App credentials)
 * - Telegram (TELEGRAM_BOT_TOKEN)
 */

import { Chat, emoji, type Adapter, type StateAdapter, type Lock, type QueueEntry } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createGitHubAdapter } from "@chat-adapter/github";
import { createTelegramAdapter } from "@chat-adapter/telegram";

import { getServerEnv } from "@/lib/env";
import { createControlClient } from "@/lib/server";
import { SpacetimeStateAdapter } from "@/lib/bot-state";

// ── In-process state adapter ─────────────────────────────────────────────────
// A lightweight Map-backed StateAdapter sufficient for stateless serverless
// deployments where each request handles its own lifecycle. For persistent
// locking/dedup across cold starts, replace with a KV-backed adapter.

class MemoryStateAdapter implements StateAdapter {
  private readonly store = new Map<string, { value: unknown; expiresAt?: number }>();
  private readonly locks = new Map<string, Lock>();
  private readonly lists = new Map<string, unknown[]>();
  private readonly queues = new Map<string, QueueEntry[]>();
  private readonly subscriptions = new Set<string>();

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  async setIfNotExists(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
    if (this.store.has(key)) return false;
    await this.set(key, value, ttlMs);
    return true;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async getList<T = unknown>(key: string): Promise<T[]> {
    return (this.lists.get(key) ?? []) as T[];
  }

  async appendToList(
    key: string,
    value: unknown,
    options?: { maxLength?: number; ttlMs?: number }
  ): Promise<void> {
    const list = this.lists.get(key) ?? [];
    list.push(value);
    if (options?.maxLength && list.length > options.maxLength) {
      list.splice(0, list.length - options.maxLength);
    }
    this.lists.set(key, list);
  }

  async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    const existing = this.locks.get(threadId);
    if (existing && Date.now() < existing.expiresAt) return null;
    const lock: Lock = {
      threadId,
      token: Math.random().toString(36).slice(2),
      expiresAt: Date.now() + ttlMs,
    };
    this.locks.set(threadId, lock);
    return lock;
  }

  async releaseLock(lock: Lock): Promise<void> {
    const existing = this.locks.get(lock.threadId);
    if (existing?.token === lock.token) {
      this.locks.delete(lock.threadId);
    }
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    const existing = this.locks.get(lock.threadId);
    if (existing?.token !== lock.token) return false;
    existing.expiresAt = Date.now() + ttlMs;
    return true;
  }

  async forceReleaseLock(threadId: string): Promise<void> {
    this.locks.delete(threadId);
  }

  async enqueue(threadId: string, entry: QueueEntry, maxSize: number): Promise<number> {
    const queue = this.queues.get(threadId) ?? [];
    queue.push(entry);
    if (queue.length > maxSize) {
      queue.splice(0, queue.length - maxSize);
    }
    this.queues.set(threadId, queue);
    return queue.length;
  }

  async dequeue(threadId: string): Promise<QueueEntry | null> {
    const queue = this.queues.get(threadId);
    if (!queue || queue.length === 0) return null;
    return queue.shift() ?? null;
  }

  async queueDepth(threadId: string): Promise<number> {
    return this.queues.get(threadId)?.length ?? 0;
  }

  async subscribe(threadId: string): Promise<void> {
    this.subscriptions.add(threadId);
  }

  async unsubscribe(threadId: string): Promise<void> {
    this.subscriptions.delete(threadId);
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    return this.subscriptions.has(threadId);
  }
}

// ── Adapter factory ───────────────────────────────────────────────────────────

async function buildAdapters() {
  const adapters: Record<string, Adapter> = {};

  if (process.env.SLACK_BOT_TOKEN) {
    adapters.slack = createSlackAdapter({
      botToken: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    });
  }

  // Discord is loaded via a dedicated module boundary so other routes do not
  // pull the optional discord.js dependency tree into their bundles.
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_PUBLIC_KEY) {
    try {
      const { createConfiguredDiscordAdapter } = await import("./bot-discord");
      const discordAdapter = await createConfiguredDiscordAdapter();
      if (discordAdapter) {
        adapters.discord = discordAdapter;
      }
    } catch {
      console.warn("[bot] Discord adapter failed to load — @chat-adapter/discord may not be installed");
    }
  }

  if (process.env.GITHUB_BOT_TOKEN) {
    adapters.github = createGitHubAdapter({
      token: process.env.GITHUB_BOT_TOKEN,
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    });
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    adapters.telegram = createTelegramAdapter({
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      secretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN,
    });
  }

  return adapters;
}

// ── Bot factory ───────────────────────────────────────────────────────────────

export async function createCadetBot() {
  const adapters = await buildAdapters();

  if (Object.keys(adapters).length === 0) {
    throw new Error(
      "No chat adapters configured. Set at least one of: SLACK_BOT_TOKEN, DISCORD_BOT_TOKEN, GITHUB_BOT_TOKEN, TELEGRAM_BOT_TOKEN"
    );
  }

  const chat = new Chat({
    userName: "cadet",
    adapters,
    state: new SpacetimeStateAdapter(),
    concurrency: "drop",
    logger: process.env.NODE_ENV === "development" ? "info" : "warn",
  });

  // ── Mention handler ─────────────────────────────────────────────────────────
  // Dispatches every new @-mention to the control plane as a job.
  chat.onNewMention(async (thread, message) => {
    const env = getServerEnv();
    const text = message.text ?? "";
    const userId = message.author?.userId ?? "unknown";

    try {
      await fetch(`${env.controlPlaneUrl}/api/inbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "chat",
          platform: thread.adapter.name,
          threadId: thread.id,
          channelId: thread.channelId,
          userId,
          text,
          raw: message,
        }),
      });
    } catch (err) {
      console.error("[cadet-bot] Failed to dispatch mention to control plane:", err);
    }

    // Record user interaction for per-user tracking
    try {
      const client = createControlClient();
      await client.callReducer("record_user_interaction", [
        `int_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        `${thread.adapter.name}:${userId}`,  // platform-prefixed user ID
        userId,                               // raw operator/user ID
        thread.adapter.name,                  // platform
        "inbound",
        text.slice(0, 200),
        thread.id,
        "",                                   // run_id (not yet assigned)
        "",                                   // sentiment (to be computed later)
      ]);
    } catch { /* best-effort */ }

    // Keyword-triggered memory extraction (no LLM, regex-only)
    try {
      const { processKeywordMemories } = await import("./keyword-memory");
      await processKeywordMemories({
        userId,
        platform: thread.adapter.name,
        text,
        threadId: thread.id,
      });
    } catch { /* best-effort */ }
  });

  // ── Reaction handler ────────────────────────────────────────────────────────
  // Emoji reactions on bot messages become trajectory feedback signals.
  // 👍/✅/🎉/🚀 = positive, 👎/❌ = negative.
  chat.onReaction(
    [emoji.thumbs_up, emoji.thumbs_down, emoji.check, emoji.x, emoji.party, emoji.rocket],
    async (event) => {
      if (!event.added) return; // only track additions, not removals

      const isPositive = [emoji.thumbs_up, emoji.check, emoji.party, emoji.rocket].some(
        (e) => e === event.emoji,
      );
      const platform = event.thread.adapter.name;
      const messageId = event.messageId;
      const userId = event.user?.userId ?? "unknown";

      try {
        const client = createControlClient();
        const scoreId = `feedback_${platform}_${messageId}_${Date.now().toString(36)}`;
        const composite = isPositive ? 1.0 : 0.0;

        await client.callReducer("record_trajectory_score", [
          scoreId,
          `traj_${messageId}`,
          `run_${platform}_${messageId}`,
          composite, composite, composite, composite, composite,
          1.0, // surprise = 1.0 (operator feedback is always novel)
          "operator-feedback",
          "",
          `${platform} reaction: ${event.rawEmoji} by ${userId}`,
          JSON.stringify({ user_feedback: isPositive, platform, emoji: event.rawEmoji, userId }),
        ]);
      } catch (err) {
        console.error("[cadet-bot] Failed to record reaction feedback:", err);
      }
    },
  );

  // ── Subscribed message handler ─────────────────────────────────────────────
  // Forward follow-up messages in subscribed threads to the control plane.
  chat.onSubscribedMessage(async (thread, message) => {
    if (message.author?.isMe) return; // skip bot's own messages

    const env = getServerEnv();
    const text = message.text ?? "";
    const userId = message.author?.userId ?? "unknown";

    try {
      await fetch(`${env.controlPlaneUrl}/api/inbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "chat",
          platform: thread.adapter.name,
          threadId: thread.id,
          channelId: thread.channelId,
          userId,
          text,
          raw: message,
          isFollowUp: true,
        }),
      });
    } catch (err) {
      console.error("[cadet-bot] Failed to dispatch subscribed message:", err);
    }

    // Record user interaction for per-user tracking
    try {
      const client = createControlClient();
      await client.callReducer("record_user_interaction", [
        `int_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        `${thread.adapter.name}:${userId}`,  // platform-prefixed user ID
        userId,                               // raw operator/user ID
        thread.adapter.name,                  // platform
        "inbound",
        text.slice(0, 200),
        thread.id,
        "",                                   // run_id (not yet assigned)
        "",                                   // sentiment (to be computed later)
      ]);
    } catch { /* best-effort */ }

    // Keyword-triggered memory extraction
    try {
      const { processKeywordMemories } = await import("./keyword-memory");
      await processKeywordMemories({
        userId,
        platform: thread.adapter.name,
        text,
        threadId: thread.id,
      });
    } catch { /* best-effort */ }
  });

  // ── Action handler ─────────────────────────────────────────────────────────
  // Handle approve/reject button clicks from rich reply cards.
  // Rich-reply.ts uses action_id: "approve_{id}" / "reject_{id}" so we
  // use a catch-all handler and filter by prefix.
  chat.onAction(async (event) => {
    const actionId = event.actionId ?? "";
    if (!actionId.startsWith("approve_") && !actionId.startsWith("reject_")) return;

    const approvalId = event.value;
    if (!approvalId || !event.thread) return;

    const thread = event.thread;
    const decision = actionId.startsWith("approve_") ? "approved" : "rejected";

    try {
      // Resolve the approval in SpacetimeDB
      const { resolveApprovalRecord } = await import("./durable-approval");
      await resolveApprovalRecord(approvalId, { status: decision, comment: `via ${thread.adapter.name}` } as never);

      // Resume workflow hook if applicable
      try {
        if (process.env.WORKFLOW_ENABLED === "true") {
          const { resumeHook } = await import("workflow/api");
          await resumeHook(approvalId, {
            approved: decision === "approved",
            comment: `Resolved via ${thread.adapter.name} by ${event.user?.userId ?? "unknown"}`,
            operatorId: event.user?.userId ?? "operator",
          });
        }
      } catch { /* hook may not exist */ }

      await thread.post({
        markdown: decision === "approved"
          ? `**Approved** by ${event.user?.fullName ?? event.user?.userName ?? "operator"}`
          : `**Rejected** by ${event.user?.fullName ?? event.user?.userName ?? "operator"}`,
      });
    } catch (err) {
      console.error("[cadet-bot] Failed to handle approval action:", err);
      await thread.post("Failed to process approval. Check the dashboard.");
    }
  });

  chat.registerSingleton();

  return chat;
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// Lazily initialized so the module can be imported without env vars present
// (e.g. during type-checking or static analysis).

let _botPromise: ReturnType<typeof createCadetBot> | undefined;

export async function getBot(): Promise<Awaited<ReturnType<typeof createCadetBot>>> {
  if (!_botPromise) {
    _botPromise = createCadetBot();
  }
  return _botPromise;
}

export { type Chat };
