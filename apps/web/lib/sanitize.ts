/**
 * LLM Input Sanitization
 *
 * Prevents prompt injection attacks by sanitizing all user-controlled
 * content before it reaches the LLM as system prompt, context, or
 * tool results.
 *
 * Attack vectors:
 * 1. Direct injection: user message contains "Ignore previous instructions..."
 * 2. Indirect injection: fetched URL/DB content contains injection payloads
 * 3. Stored injection: previously saved memory/thread contains payload
 *
 * Strategy:
 * - Strip known injection patterns from context injections (not user messages —
 *   the LLM needs to see the real user intent)
 * - Fence injected context with clear delimiters so the LLM treats it as data
 * - Truncate to prevent context flooding
 * - Strip control characters and null bytes
 */

/** Characters that could be used to break out of delimited sections. */
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Patterns commonly used in prompt injection attacks. */
const INJECTION_PATTERNS = [
  /ignore (?:all )?(?:previous|prior|above|earlier) (?:instructions|prompts|rules|context)/gi,
  /you are now (?:a |an )?(?:new |different )?(?:AI|assistant|agent|bot)/gi,
  /(?:system|admin|root|sudo|override)[\s:]*(?:prompt|instruction|command|override)/gi,
  /\[(?:SYSTEM|INST|SYS)\]/gi,
  /<<\s*(?:SYS|SYSTEM|INST)\s*>>/gi,
  /```\s*(?:system|instruction|prompt)\b/gi,
  /\bdo not follow\b.*\b(?:rules|instructions|guidelines)\b/gi,
  /\bpretend\b.*\byou are\b/gi,
  /\brole[\s-]*play\b.*\bas\b/gi,
  /\bnew (?:system )?prompt\b/gi,
  /\boverride\b.*\b(?:safety|guard|filter|restriction)\b/gi,
  /\bdisregard\b.*\b(?:above|previous|prior)\b/gi,
];

/**
 * Sanitize content that will be injected into the LLM context
 * (system prompt additions, @ ref content, tool results, memory).
 *
 * This does NOT sanitize user messages — those need to pass through
 * as-is for the LLM to understand user intent.
 */
export function sanitizeContext(content: string, maxLength: number = 8000): string {
  let sanitized = content;

  // Strip control characters (keep newlines and tabs)
  sanitized = sanitized.replace(CONTROL_CHARS, "");

  // Neutralize injection patterns by wrapping matched text in [FILTERED]
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[FILTERED]");
  }

  // Truncate
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + "\n[TRUNCATED]";
  }

  return sanitized;
}

/**
 * Fence content with clear delimiters so the LLM treats it as quoted data,
 * not as instructions. Use for all injected context.
 */
export function fenceContext(label: string, content: string): string {
  const sanitized = sanitizeContext(content);
  return `<context source="${escapeAttr(label)}">\n${sanitized}\n</context>`;
}

/**
 * Sanitize a URL before fetching to prevent SSRF.
 * Only allows http/https, blocks private/internal networks.
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Only allow http/https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    // Block private/internal networks
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.2") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.") ||
      hostname.startsWith("192.168.") ||
      hostname === "metadata.google.internal" ||
      hostname === "169.254.169.254" // AWS/GCP metadata
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize HTML content fetched from URLs.
 * Strips tags, scripts, styles, and normalizes whitespace.
 */
export function sanitizeHtml(html: string, maxLength: number = 4000): string {
  let text = html;

  // Remove script/style blocks entirely
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Strip all HTML tags
  text = text.replace(/<[^>]*>/g, " ");

  // Decode common entities
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Apply context sanitization (injection patterns)
  return sanitizeContext(text, maxLength);
}

/**
 * Sanitize tool result content before it's fed back to the LLM.
 */
export function sanitizeToolResult(result: unknown): unknown {
  if (typeof result === "string") {
    return sanitizeContext(result, 4000);
  }
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        sanitized[key] = sanitizeContext(value, 2000);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  return result;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
