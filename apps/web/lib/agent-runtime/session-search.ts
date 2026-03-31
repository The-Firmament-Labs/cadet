/**
 * Cadet Session Search
 *
 * Full-text search across past conversations, run outputs, and agent logs.
 * Hermes uses SQLite FTS5. We use SpacetimeDB SQL LIKE queries with
 * keyword extraction — and can upgrade to vector search when SpacetimeDB
 * adds embedding support.
 */

import { createControlClient } from "../server";
import { sqlEscape } from "../sql";

export interface SearchResult {
  type: "chat" | "run" | "memory" | "thread";
  id: string;
  title: string;
  content: string;
  relevance: number;
  timestamp: number;
}

/** Search across all conversation history and agent artifacts. */
export async function searchSessions(
  query: string,
  opts?: { operatorId?: string; type?: SearchResult["type"]; limit?: number },
): Promise<SearchResult[]> {
  const limit = Math.min(opts?.limit ?? 20, 50);
  const keywords = extractKeywords(query);

  if (keywords.length === 0) return [];

  const client = createControlClient();
  const results: SearchResult[] = [];

  // Build LIKE conditions from keywords
  const likeConditions = (column: string) =>
    keywords.map((k) => `${column} LIKE '%${sqlEscape(k)}%'`).join(" OR ");

  // Search chat messages
  if (!opts?.type || opts.type === "chat") {
    try {
      const operatorFilter = opts?.operatorId
        ? `AND operator_id = '${sqlEscape(opts.operatorId)}'`
        : "";
      const rows = (await client.sql(
        `SELECT message_id, role, content, created_at_micros FROM chat_message WHERE (${likeConditions("content")}) ${operatorFilter} ORDER BY created_at_micros DESC LIMIT ${limit}`,
      )) as Record<string, unknown>[];

      for (const r of rows) {
        const content = String(r.content ?? "");
        results.push({
          type: "chat",
          id: String(r.message_id),
          title: `${String(r.role)} message`,
          content: content.slice(0, 200),
          relevance: scoreRelevance(content, keywords),
          timestamp: Number(r.created_at_micros ?? 0) / 1000,
        });
      }
    } catch { /* table may not exist */ }
  }

  // Search workflow runs
  if (!opts?.type || opts.type === "run") {
    try {
      const rows = (await client.sql(
        `SELECT run_id, agent_id, goal, status, updated_at_micros FROM workflow_run WHERE (${likeConditions("goal")}) ORDER BY updated_at_micros DESC LIMIT ${limit}`,
      )) as Record<string, unknown>[];

      for (const r of rows) {
        const goal = String(r.goal ?? "");
        results.push({
          type: "run",
          id: String(r.run_id),
          title: `${String(r.agent_id)}: ${goal.slice(0, 60)}`,
          content: `Status: ${String(r.status)} — ${goal}`,
          relevance: scoreRelevance(goal, keywords),
          timestamp: Number(r.updated_at_micros ?? 0) / 1000,
        });
      }
    } catch { /* table may not exist */ }
  }

  // Search memory documents
  if (!opts?.type || opts.type === "memory") {
    try {
      const rows = (await client.sql(
        `SELECT document_id, title, content, updated_at_micros FROM memory_document WHERE (${likeConditions("content")}) OR (${likeConditions("title")}) ORDER BY updated_at_micros DESC LIMIT ${limit}`,
      )) as Record<string, unknown>[];

      for (const r of rows) {
        const content = String(r.content ?? "");
        const title = String(r.title ?? "");
        results.push({
          type: "memory",
          id: String(r.document_id),
          title,
          content: content.slice(0, 200),
          relevance: scoreRelevance(`${title} ${content}`, keywords),
          timestamp: Number(r.updated_at_micros ?? 0) / 1000,
        });
      }
    } catch { /* table may not exist */ }
  }

  // Search threads
  if (!opts?.type || opts.type === "thread") {
    try {
      const rows = (await client.sql(
        `SELECT thread_id, title, updated_at_micros FROM thread_record WHERE (${likeConditions("title")}) ORDER BY updated_at_micros DESC LIMIT ${limit}`,
      )) as Record<string, unknown>[];

      for (const r of rows) {
        const title = String(r.title ?? "");
        results.push({
          type: "thread",
          id: String(r.thread_id),
          title,
          content: title,
          relevance: scoreRelevance(title, keywords),
          timestamp: Number(r.updated_at_micros ?? 0) / 1000,
        });
      }
    } catch { /* table may not exist */ }
  }

  // Sort by relevance, then recency
  results.sort((a, b) => {
    const relDiff = b.relevance - a.relevance;
    if (Math.abs(relDiff) > 0.1) return relDiff;
    return b.timestamp - a.timestamp;
  });

  return results.slice(0, limit);
}

/** Extract meaningful keywords from a search query. */
function extractKeywords(query: string): string[] {
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to", "for", "of", "and", "or", "not", "with", "this", "that", "it", "as", "by", "from", "be", "has", "had", "do", "does", "did", "will", "would", "can", "could", "should", "may", "might"]);

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 5);
}

/** Score how relevant a text is to the keywords (0-1). */
function scoreRelevance(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let matches = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) matches++;
  }
  return keywords.length > 0 ? matches / keywords.length : 0;
}
