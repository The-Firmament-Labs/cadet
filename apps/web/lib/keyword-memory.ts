/**
 * Keyword-triggered memory extraction.
 *
 * Programmatically detects memorable patterns in user messages and stores
 * them as per-user memories WITHOUT requiring LLM involvement. This runs
 * on every inbound message and is designed to be fast (regex only, no AI).
 *
 * Categories:
 * - Preferences: "I prefer", "I like", "I always", "I never", "don't ever"
 * - Identity: "my name is", "I'm a", "I work on", "my role is"
 * - Tech stack: "we use", "our stack", "we deploy with", "our repo"
 * - Corrections: "actually it's", "no, it's", "the correct"
 * - Workflows: "our process is", "we always", "the rule is", "never do"
 * - Contacts: "email me at", "reach me on", "my handle is"
 */

import { createControlClient } from "./server";

interface MemoryMatch {
  category: string;
  pattern: string;
  extract: string;
}

const PATTERNS: Array<{
  category: string;
  regex: RegExp;
  /** Which capture group has the content (0 = full match) */
  group: number;
}> = [
  // Preferences
  { category: "preference", regex: /\b(?:i\s+(?:prefer|like|love|want|need)\s+)(.{5,120})/i, group: 1 },
  { category: "preference", regex: /\b(?:i\s+(?:always|usually|typically)\s+)(.{5,120})/i, group: 1 },
  { category: "preference", regex: /\b(?:i\s+(?:never|hate|dislike|avoid)\s+)(.{5,120})/i, group: 1 },
  { category: "preference", regex: /\b(?:don'?t\s+ever\s+)(.{5,80})/i, group: 1 },
  { category: "preference", regex: /\b(?:please\s+(?:always|never)\s+)(.{5,80})/i, group: 1 },

  // Identity
  { category: "identity", regex: /\b(?:my\s+name\s+is\s+)(\S+(?:\s+\S+)?)/i, group: 1 },
  { category: "identity", regex: /\b(?:i'?m\s+a\s+)(.{3,60})/i, group: 1 },
  { category: "identity", regex: /\b(?:my\s+(?:role|title|position)\s+is\s+)(.{3,60})/i, group: 1 },
  { category: "identity", regex: /\b(?:i\s+work\s+(?:on|at|for|with)\s+)(.{3,80})/i, group: 1 },

  // Tech stack
  { category: "tech-stack", regex: /\b(?:we\s+use\s+)(.{3,100})/i, group: 1 },
  { category: "tech-stack", regex: /\b(?:our\s+(?:stack|tech|framework|tooling)\s+(?:is|includes)\s+)(.{3,100})/i, group: 1 },
  { category: "tech-stack", regex: /\b(?:we\s+deploy\s+(?:with|to|on|via)\s+)(.{3,80})/i, group: 1 },
  { category: "tech-stack", regex: /\b(?:our\s+(?:repo|repository|codebase)\s+(?:is|lives)\s+)(.{3,100})/i, group: 1 },
  { category: "tech-stack", regex: /\b(?:we\s+run\s+(?:on|in)\s+)(.{3,80})/i, group: 1 },

  // Corrections
  { category: "correction", regex: /\b(?:actually,?\s+(?:it'?s|that'?s|the)\s+)(.{3,100})/i, group: 1 },
  { category: "correction", regex: /\b(?:no,?\s+(?:it'?s|that'?s|the)\s+)(.{3,100})/i, group: 1 },
  { category: "correction", regex: /\b(?:the\s+correct\s+(?:\w+\s+)?is\s+)(.{3,80})/i, group: 1 },

  // Workflows & rules
  { category: "workflow", regex: /\b(?:our\s+process\s+(?:is|for)\s+)(.{5,120})/i, group: 1 },
  { category: "workflow", regex: /\b(?:we\s+always\s+)(.{5,100})/i, group: 1 },
  { category: "workflow", regex: /\b(?:the\s+rule\s+is\s+)(.{5,100})/i, group: 1 },
  { category: "workflow", regex: /\b(?:never\s+(?:do|use|deploy|push|merge)\s+)(.{3,80})/i, group: 1 },

  // Contacts
  { category: "contact", regex: /\b(?:(?:email|reach|contact|ping)\s+me\s+(?:at|on)\s+)(\S+)/i, group: 1 },
  { category: "contact", regex: /\b(?:my\s+(?:email|handle|username|slack|discord)\s+is\s+)(\S+)/i, group: 1 },

  // Project context
  { category: "project", regex: /\b(?:the\s+project\s+(?:is|name)\s+)(.{3,60})/i, group: 1 },
  { category: "project", regex: /\b(?:we'?re\s+(?:building|working\s+on|shipping)\s+)(.{5,100})/i, group: 1 },
];

/**
 * Extract memorable patterns from a message.
 * Returns all matches found (may be empty).
 */
export function extractKeywordMemories(text: string): MemoryMatch[] {
  const matches: MemoryMatch[] = [];
  const seen = new Set<string>();

  for (const { category, regex, group } of PATTERNS) {
    const m = text.match(regex);
    if (m && m[group]) {
      const extract = m[group]!.trim().replace(/[.!?]+$/, "");
      // Deduplicate within the same message
      const key = `${category}:${extract.toLowerCase()}`;
      if (!seen.has(key) && extract.length >= 3) {
        seen.add(key);
        matches.push({ category, pattern: regex.source, extract });
      }
    }
  }

  return matches;
}

/**
 * Process a message and store any keyword-extracted memories for the user.
 * Called from bot.ts handlers and the chat route — fire-and-forget.
 */
export async function processKeywordMemories(opts: {
  userId: string;
  platform: string;
  text: string;
  threadId?: string;
}): Promise<{ stored: number; memories: string[] }> {
  const { userId, platform, text, threadId } = opts;
  const matches = extractKeywordMemories(text);

  if (matches.length === 0) return { stored: 0, memories: [] };

  const client = createControlClient();
  const storedTitles: string[] = [];

  for (const match of matches) {
    const docId = `kwmem_${platform}_${userId}_${match.category}_${Date.now().toString(36)}`;
    const title = `${match.category}: ${match.extract.slice(0, 60)}`;

    try {
      await client.callReducer("upsert_memory_document", [
        docId,
        `user_${userId}`,         // agent_id = user scope
        "user-memory",             // namespace
        "keyword-extract",         // source_kind
        title,
        match.extract,
        JSON.stringify({
          category: match.category,
          platform,
          threadId,
          extractedAt: new Date().toISOString(),
        }),
      ]);
      storedTitles.push(title);
    } catch {
      // best-effort per memory
    }
  }

  return { stored: storedTitles.length, memories: storedTitles };
}
