/**
 * Cadet Internet Channels
 *
 * Gives agents structured internet access through pluggable channels.
 * Inspired by Agent Reach's scaffolding pattern, built for our stack:
 * - Credentials in SpacetimeDB (not flat files)
 * - Channels exposed as chat tools (not CLI commands)
 * - Results stored in memory for future reference
 * - SSRF protection via sanitizeUrl
 *
 * Zero-config channels (work immediately):
 * - web: fetch and parse any URL
 * - search: semantic web search
 * - github: public repo/issue/PR data
 *
 * Auth-required channels:
 * - youtube: subtitles + search (API key optional, works without)
 * - reddit: subreddit + post data
 * - rss: feed parsing
 */

import { sanitizeUrl, sanitizeHtml, sanitizeContext } from "../sanitize";

// ── Channel types ────────────────────────────────────────────────────

export interface ChannelResult {
  channel: string;
  success: boolean;
  content: string;
  metadata: Record<string, unknown>;
  tokenEstimate: number;
}

export interface ChannelStatus {
  id: string;
  name: string;
  available: boolean;
  authRequired: boolean;
  authConfigured: boolean;
  description: string;
}

// ── Web channel (zero-config) ────────────────────────────────────────

export async function fetchWebPage(url: string): Promise<ChannelResult> {
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) return { channel: "web", success: false, content: "URL blocked (private network or invalid)", metadata: {}, tokenEstimate: 0 };

  try {
    // Use Jina Reader API for clean extraction (free, no API key)
    const jinaUrl = `https://r.jina.ai/${safeUrl}`;
    const res = await fetch(jinaUrl, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });

    if (!res.ok) {
      // Fallback to direct fetch + HTML strip
      const directRes = await fetch(safeUrl, { signal: AbortSignal.timeout(10_000), redirect: "error" });
      if (!directRes.ok) return { channel: "web", success: false, content: `Fetch failed: ${directRes.status}`, metadata: { url: safeUrl }, tokenEstimate: 0 };
      const html = await directRes.text();
      const text = sanitizeHtml(html, 6000);
      return { channel: "web", success: true, content: text, metadata: { url: safeUrl, method: "direct" }, tokenEstimate: Math.ceil(text.length / 4) };
    }

    const text = sanitizeContext(await res.text(), 6000);
    return { channel: "web", success: true, content: text, metadata: { url: safeUrl, method: "jina" }, tokenEstimate: Math.ceil(text.length / 4) };
  } catch (error) {
    return { channel: "web", success: false, content: error instanceof Error ? error.message : "Fetch failed", metadata: { url: safeUrl }, tokenEstimate: 0 };
  }
}

// ── Search channel (zero-config with optional API key) ───────────────

export async function searchWeb(query: string, limit: number = 5): Promise<ChannelResult> {
  try {
    // Use DuckDuckGo instant answer API (free, no key)
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return { channel: "search", success: false, content: `Search failed: ${res.status}`, metadata: { query }, tokenEstimate: 0 };

    const data = (await res.json()) as {
      AbstractText?: string;
      AbstractSource?: string;
      AbstractURL?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };

    const results: string[] = [];

    if (data.AbstractText) {
      results.push(`**${data.AbstractSource ?? "Result"}**: ${data.AbstractText}`);
      if (data.AbstractURL) results.push(`Source: ${data.AbstractURL}`);
    }

    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, limit)) {
        if (topic.Text) {
          results.push(`- ${sanitizeContext(topic.Text, 200)}${topic.FirstURL ? ` (${topic.FirstURL})` : ""}`);
        }
      }
    }

    const content = results.length > 0 ? results.join("\n") : "No results found";
    return { channel: "search", success: results.length > 0, content, metadata: { query, resultCount: results.length }, tokenEstimate: Math.ceil(content.length / 4) };
  } catch (error) {
    return { channel: "search", success: false, content: error instanceof Error ? error.message : "Search failed", metadata: { query }, tokenEstimate: 0 };
  }
}

// ── YouTube channel (zero-config for public videos) ──────────────────

export async function fetchYouTubeInfo(videoUrl: string): Promise<ChannelResult> {
  try {
    // Extract video ID
    const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!match) return { channel: "youtube", success: false, content: "Invalid YouTube URL", metadata: {}, tokenEstimate: 0 };
    const videoId = match[1]!;

    // Use oEmbed API (free, no key needed)
    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!oembedRes.ok) return { channel: "youtube", success: false, content: `YouTube API error: ${oembedRes.status}`, metadata: { videoId }, tokenEstimate: 0 };

    const oembed = (await oembedRes.json()) as { title?: string; author_name?: string; thumbnail_url?: string };

    // Try to get transcript via Jina Reader
    let transcript = "";
    try {
      const jinaRes = await fetch(`https://r.jina.ai/https://www.youtube.com/watch?v=${videoId}`, {
        headers: { Accept: "text/plain" },
        signal: AbortSignal.timeout(15_000),
      });
      if (jinaRes.ok) {
        transcript = sanitizeContext(await jinaRes.text(), 4000);
      }
    } catch { /* transcript extraction is best-effort */ }

    const content = [
      `**${oembed.title ?? "Unknown"}** by ${oembed.author_name ?? "Unknown"}`,
      transcript ? `\n## Transcript\n${transcript}` : "(Transcript not available)",
    ].join("\n");

    return {
      channel: "youtube",
      success: true,
      content,
      metadata: { videoId, title: oembed.title, author: oembed.author_name },
      tokenEstimate: Math.ceil(content.length / 4),
    };
  } catch (error) {
    return { channel: "youtube", success: false, content: error instanceof Error ? error.message : "YouTube fetch failed", metadata: {}, tokenEstimate: 0 };
  }
}

// ── GitHub channel (zero-config for public repos) ────────────────────

export async function fetchGitHubData(query: string): Promise<ChannelResult> {
  try {
    // Parse: "owner/repo", "owner/repo#123", "owner/repo/issues"
    const repoMatch = query.match(/^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
    if (!repoMatch) return { channel: "github", success: false, content: "Provide a repo as owner/repo", metadata: {}, tokenEstimate: 0 };

    const repo = repoMatch[1]!;
    const issueMatch = query.match(/#(\d+)/);
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    if (issueMatch) {
      // Fetch specific issue/PR
      const num = issueMatch[1]!;
      const res = await fetch(`https://api.github.com/repos/${repo}/issues/${num}`, {
        headers, signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return { channel: "github", success: false, content: `GitHub API: ${res.status}`, metadata: { repo }, tokenEstimate: 0 };
      const issue = (await res.json()) as { title?: string; body?: string; state?: string; user?: { login?: string }; labels?: Array<{ name: string }> };

      const content = [
        `**#${num}: ${issue.title}** (${issue.state}) by @${issue.user?.login ?? "unknown"}`,
        issue.labels?.length ? `Labels: ${issue.labels.map((l) => l.name).join(", ")}` : "",
        issue.body ? sanitizeContext(issue.body, 2000) : "(No description)",
      ].filter(Boolean).join("\n");

      return { channel: "github", success: true, content, metadata: { repo, issue: num }, tokenEstimate: Math.ceil(content.length / 4) };
    }

    // Fetch repo info
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers, signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { channel: "github", success: false, content: `GitHub API: ${res.status}`, metadata: { repo }, tokenEstimate: 0 };
    const repoData = (await res.json()) as { description?: string; stargazers_count?: number; language?: string; topics?: string[]; open_issues_count?: number; default_branch?: string };

    const content = [
      `**${repo}**: ${repoData.description ?? "No description"}`,
      `Stars: ${repoData.stargazers_count ?? 0} | Language: ${repoData.language ?? "unknown"} | Issues: ${repoData.open_issues_count ?? 0}`,
      repoData.topics?.length ? `Topics: ${repoData.topics.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    return { channel: "github", success: true, content, metadata: { repo, stars: repoData.stargazers_count }, tokenEstimate: Math.ceil(content.length / 4) };
  } catch (error) {
    return { channel: "github", success: false, content: error instanceof Error ? error.message : "GitHub fetch failed", metadata: {}, tokenEstimate: 0 };
  }
}

// ── RSS channel (zero-config) ────────────────────────────────────────

export async function fetchRssFeed(feedUrl: string, limit: number = 5): Promise<ChannelResult> {
  const safeUrl = sanitizeUrl(feedUrl);
  if (!safeUrl) return { channel: "rss", success: false, content: "URL blocked", metadata: {}, tokenEstimate: 0 };

  try {
    const res = await fetch(safeUrl, { signal: AbortSignal.timeout(10_000), redirect: "error" });
    if (!res.ok) return { channel: "rss", success: false, content: `RSS fetch failed: ${res.status}`, metadata: {}, tokenEstimate: 0 };

    const xml = await res.text();

    // Simple XML parsing for RSS/Atom items
    const items: Array<{ title: string; link: string; description: string }> = [];
    const itemRegex = /<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi;
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = itemRegex.exec(xml)) !== null && items.length < limit) {
      const itemXml = itemMatch[0];
      const title = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1") ?? "";
      const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i) ?? itemXml.match(/<link[^>]*href="([^"]*)"/);
      const link = linkMatch?.[1] ?? "";
      const desc = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>|<summary[^>]*>([\s\S]*?)<\/summary>/i);
      const description = sanitizeHtml(desc?.[1] ?? desc?.[2] ?? "", 200);

      items.push({ title: title.trim(), link: link.trim(), description });
    }

    if (items.length === 0) return { channel: "rss", success: false, content: "No items found in feed", metadata: { url: safeUrl }, tokenEstimate: 0 };

    const content = items.map((item) =>
      `- **${sanitizeContext(item.title, 100)}**${item.link ? ` (${item.link})` : ""}\n  ${item.description}`,
    ).join("\n");

    return { channel: "rss", success: true, content, metadata: { url: safeUrl, itemCount: items.length }, tokenEstimate: Math.ceil(content.length / 4) };
  } catch (error) {
    return { channel: "rss", success: false, content: error instanceof Error ? error.message : "RSS fetch failed", metadata: {}, tokenEstimate: 0 };
  }
}

// ── Doctor: check what's available ───────────────────────────────────

export async function checkChannelStatus(): Promise<ChannelStatus[]> {
  return [
    { id: "web", name: "Web Pages", available: true, authRequired: false, authConfigured: true, description: "Fetch and parse any URL via Jina Reader" },
    { id: "search", name: "Web Search", available: true, authRequired: false, authConfigured: true, description: "DuckDuckGo instant answers + related topics" },
    { id: "youtube", name: "YouTube", available: true, authRequired: false, authConfigured: true, description: "Video info + transcript via Jina Reader" },
    { id: "github", name: "GitHub", available: true, authRequired: false, authConfigured: Boolean(process.env.GITHUB_TOKEN), description: "Repos, issues, PRs via GitHub API" },
    { id: "rss", name: "RSS/Atom Feeds", available: true, authRequired: false, authConfigured: true, description: "Parse any RSS or Atom feed" },
  ];
}

// ── Unified fetch: auto-detect channel from URL/query ────────────────

export async function fetchFromChannel(input: string): Promise<ChannelResult> {
  const trimmed = input.trim();

  // YouTube
  if (trimmed.match(/youtube\.com|youtu\.be/)) {
    return fetchYouTubeInfo(trimmed);
  }

  // GitHub (owner/repo pattern)
  if (trimmed.match(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:#\d+)?$/)) {
    return fetchGitHubData(trimmed);
  }

  // RSS (common feed URLs)
  if (trimmed.match(/\.xml|\/feed|\/rss|atom\.xml/i)) {
    return fetchRssFeed(trimmed);
  }

  // URL — fetch as web page
  if (trimmed.match(/^https?:\/\//)) {
    return fetchWebPage(trimmed);
  }

  // Plain text — search
  return searchWeb(trimmed);
}
