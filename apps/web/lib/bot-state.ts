/**
 * SpacetimeDB-backed Chat SDK State Adapter
 *
 * Replaces the in-memory MemoryStateAdapter with durable state stored
 * in SpacetimeDB's chat_bot_state table. Survives serverless cold starts.
 *
 * Uses:
 * - SQL queries for reads (get, getList, isSubscribed, queueDepth)
 * - Reducers for writes (upsert_chat_bot_state, delete_chat_bot_state)
 */

import type { StateAdapter, Lock, QueueEntry } from "chat";
import { createControlClient } from "./server";
import { sqlEscape } from "./sql";

export class SpacetimeStateAdapter implements StateAdapter {
  async connect(): Promise<void> {
    // SpacetimeDB connection is managed per-request by createControlClient
  }

  async disconnect(): Promise<void> {}

  // ── KV operations ──────────────────────────────────────────────────

  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const client = createControlClient();
      const rows = (await client.sql(
        `SELECT value_json, expires_at_micros FROM chat_bot_state WHERE key = '${sqlEscape(key)}'`,
      )) as Array<{ value_json: string; expires_at_micros: number }>;

      if (rows.length === 0) return null;
      const row = rows[0]!;

      // Check TTL
      if (row.expires_at_micros > 0 && Date.now() * 1000 > row.expires_at_micros) {
        await this.delete(key);
        return null;
      }

      return JSON.parse(row.value_json) as T;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    try {
      const client = createControlClient();
      const expiresAt = ttlMs ? (Date.now() + ttlMs) * 1000 : 0;
      await client.callReducer("upsert_chat_bot_state", [
        key,
        JSON.stringify(value),
        "kv",
        expiresAt,
      ]);
    } catch (err) {
      console.error("[bot-state] set failed:", err);
    }
  }

  async setIfNotExists(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
    const existing = await this.get(key);
    if (existing !== null) return false;
    await this.set(key, value, ttlMs);
    return true;
  }

  async delete(key: string): Promise<void> {
    try {
      const client = createControlClient();
      await client.callReducer("delete_chat_bot_state", [key]);
    } catch (err) {
      console.error("[bot-state] delete failed:", err);
    }
  }

  // ── List operations ────────────────────────────────────────────────

  async getList<T = unknown>(key: string): Promise<T[]> {
    const data = await this.get<T[]>(`list:${key}`);
    return data ?? [];
  }

  async appendToList(
    key: string,
    value: unknown,
    options?: { maxLength?: number; ttlMs?: number },
  ): Promise<void> {
    const list = await this.getList(`${key}`);
    list.push(value);
    if (options?.maxLength && list.length > options.maxLength) {
      list.splice(0, list.length - options.maxLength);
    }
    await this.set(`list:${key}`, list, options?.ttlMs);
  }

  // ── Lock operations ────────────────────────────────────────────────

  async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    const lockKey = `lock:${threadId}`;
    const existing = await this.get<Lock>(lockKey);

    if (existing && Date.now() < existing.expiresAt) {
      return null; // lock held
    }

    const lock: Lock = {
      threadId,
      token: Math.random().toString(36).slice(2) + Date.now().toString(36),
      expiresAt: Date.now() + ttlMs,
    };

    await this.set(lockKey, lock, ttlMs);
    return lock;
  }

  async releaseLock(lock: Lock): Promise<void> {
    const lockKey = `lock:${lock.threadId}`;
    const existing = await this.get<Lock>(lockKey);
    if (existing?.token === lock.token) {
      await this.delete(lockKey);
    }
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    const lockKey = `lock:${lock.threadId}`;
    const existing = await this.get<Lock>(lockKey);
    if (existing?.token !== lock.token) return false;

    const extended: Lock = { ...lock, expiresAt: Date.now() + ttlMs };
    await this.set(lockKey, extended, ttlMs);
    return true;
  }

  async forceReleaseLock(threadId: string): Promise<void> {
    await this.delete(`lock:${threadId}`);
  }

  // ── Queue operations ───────────────────────────────────────────────

  async enqueue(threadId: string, entry: QueueEntry, maxSize: number): Promise<number> {
    const queueKey = `queue:${threadId}`;
    const queue = await this.get<QueueEntry[]>(queueKey) ?? [];
    queue.push(entry);
    if (queue.length > maxSize) {
      queue.splice(0, queue.length - maxSize);
    }
    await this.set(queueKey, queue);
    return queue.length;
  }

  async dequeue(threadId: string): Promise<QueueEntry | null> {
    const queueKey = `queue:${threadId}`;
    const queue = await this.get<QueueEntry[]>(queueKey) ?? [];
    if (queue.length === 0) return null;
    const entry = queue.shift()!;
    await this.set(queueKey, queue);
    return entry;
  }

  async queueDepth(threadId: string): Promise<number> {
    const queue = await this.get<QueueEntry[]>(`queue:${threadId}`) ?? [];
    return queue.length;
  }

  // ── Subscription operations ────────────────────────────────────────

  async subscribe(threadId: string): Promise<void> {
    try {
      const client = createControlClient();
      await client.callReducer("upsert_chat_bot_state", [
        `sub:${threadId}`,
        "true",
        "subscription",
        0, // no expiry
      ]);
    } catch (err) {
      console.error("[bot-state] subscribe failed:", err);
    }
  }

  async unsubscribe(threadId: string): Promise<void> {
    await this.delete(`sub:${threadId}`);
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    try {
      const client = createControlClient();
      const rows = (await client.sql(
        `SELECT key FROM chat_bot_state WHERE key = '${sqlEscape(`sub:${threadId}`)}'`,
      )) as unknown[];
      return rows.length > 0;
    } catch {
      return false;
    }
  }
}
