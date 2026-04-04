/**
 * Cadet Provider Routing & Fallback System
 *
 * Route AI requests based on cost, speed, or quality preferences.
 * Automatic failover to backup providers when primary fails.
 *
 * Hermes uses OpenRouter's routing. We use Vercel AI Gateway natively —
 * model strings like "anthropic/claude-sonnet-4.5" route through the gateway
 * automatically with OIDC auth, cost tracking, and observability built in.
 *
 * Our advantage: SpacetimeDB stores per-operator routing preferences,
 * cost history, and provider health — enabling data-driven routing.
 */

import { createControlClient } from "../server";
import { sqlEscape } from "../sql";

export type RoutingStrategy = "cost" | "speed" | "quality" | "balanced";

export interface ProviderConfig {
  /** AI Gateway model string: "provider/model" */
  model: string;
  /** Human-readable name */
  name: string;
  /** Relative cost (1 = cheapest) */
  costTier: number;
  /** Relative speed (1 = fastest) */
  speedTier: number;
  /** Relative quality (1 = best) */
  qualityTier: number;
  /** Capabilities */
  capabilities: string[];
}

export interface RoutingPreference {
  strategy: RoutingStrategy;
  /** Explicitly preferred providers (tried first) */
  preferred?: string[];
  /** Explicitly blocked providers (never used) */
  blocked?: string[];
  /** Max cost tier to consider */
  maxCostTier?: number;
}

// ── Provider catalog ─────────────────────────────────────────────────

const PROVIDER_CATALOG: ProviderConfig[] = [
  // Anthropic
  { model: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", costTier: 2, speedTier: 2, qualityTier: 1, capabilities: ["code", "reasoning", "vision"] },
  { model: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", costTier: 1, speedTier: 1, qualityTier: 3, capabilities: ["code", "fast"] },
  // OpenAI
  { model: "openai/gpt-5.4", name: "GPT-5.4", costTier: 2, speedTier: 2, qualityTier: 1, capabilities: ["code", "reasoning", "vision"] },
  { model: "openai/gpt-5.4-mini", name: "GPT-5.4 Mini", costTier: 1, speedTier: 1, qualityTier: 2, capabilities: ["code", "fast"] },
  // Google
  { model: "google/gemini-3.1-flash", name: "Gemini 3.1 Flash", costTier: 1, speedTier: 1, qualityTier: 2, capabilities: ["code", "fast", "vision"] },
  { model: "google/gemini-3.1-pro", name: "Gemini 3.1 Pro", costTier: 3, speedTier: 3, qualityTier: 1, capabilities: ["code", "reasoning", "vision"] },
  // DeepSeek
  { model: "deepseek/deepseek-r1", name: "DeepSeek R1", costTier: 1, speedTier: 3, qualityTier: 2, capabilities: ["code", "reasoning"] },
  // xAI
  { model: "xai/grok-3", name: "Grok 3", costTier: 2, speedTier: 2, qualityTier: 2, capabilities: ["code", "reasoning"] },
  // ElizaOS Cloud (opt-in — requires ELIZAOS_API_KEY)
  { model: "elizaos/gemini-2.5-flash", name: "ElizaOS Cloud (Gemini)", costTier: 1, speedTier: 1, qualityTier: 2, capabilities: ["crypto", "fast"] },
  { model: "elizaos/claude-sonnet-4.5", name: "ElizaOS Cloud (Claude)", costTier: 2, speedTier: 2, qualityTier: 1, capabilities: ["crypto", "reasoning"] },
];

/** Select the best model based on routing strategy and preferences. */
export function selectModel(
  preferences: RoutingPreference,
  requiredCapabilities?: string[],
): string {
  let candidates = [...PROVIDER_CATALOG];

  // Filter by capabilities
  if (requiredCapabilities?.length) {
    candidates = candidates.filter((p) =>
      requiredCapabilities.every((cap) => p.capabilities.includes(cap)),
    );
  }

  // Filter blocked
  if (preferences.blocked?.length) {
    candidates = candidates.filter((p) => !preferences.blocked!.includes(p.model));
  }

  // Filter by cost tier
  if (preferences.maxCostTier !== undefined) {
    candidates = candidates.filter((p) => p.costTier <= preferences.maxCostTier!);
  }

  if (candidates.length === 0) {
    return "anthropic/claude-sonnet-4.5"; // safe fallback
  }

  // Separate preferred from rest
  const preferred: ProviderConfig[] = [];
  const rest: ProviderConfig[] = [];
  if (preferences.preferred?.length) {
    for (const c of candidates) {
      if (preferences.preferred.includes(c.model)) preferred.push(c);
      else rest.push(c);
    }
  } else {
    rest.push(...candidates);
  }

  // Sort non-preferred by strategy
  const sortFn = (a: ProviderConfig, b: ProviderConfig) => {
    switch (preferences.strategy) {
      case "cost": return a.costTier - b.costTier;
      case "speed": return a.speedTier - b.speedTier;
      case "quality": return a.qualityTier - b.qualityTier;
      case "balanced": return (a.costTier + a.speedTier + a.qualityTier) - (b.costTier + b.speedTier + b.qualityTier);
    }
  };
  preferred.sort(sortFn);
  rest.sort(sortFn);

  // Preferred always comes first
  const sorted = [...preferred, ...rest];
  return sorted[0]!.model;
}

/** Build a fallback chain: primary → backup models. */
export function buildFallbackChain(
  preferences: RoutingPreference,
  requiredCapabilities?: string[],
  maxFallbacks: number = 3,
): string[] {
  let candidates = [...PROVIDER_CATALOG];

  if (requiredCapabilities?.length) {
    candidates = candidates.filter((p) =>
      requiredCapabilities.every((cap) => p.capabilities.includes(cap)),
    );
  }

  if (preferences.blocked?.length) {
    candidates = candidates.filter((p) => !preferences.blocked!.includes(p.model));
  }

  // Sort by quality for fallback (we want the best alternatives)
  candidates.sort((a, b) => a.qualityTier - b.qualityTier);

  // Primary first
  const primary = selectModel(preferences, requiredCapabilities);
  const chain = [primary];

  // Add fallbacks from different providers
  const usedProviders = new Set([primary.split("/")[0]]);
  for (const c of candidates) {
    if (chain.length >= maxFallbacks) break;
    const provider = c.model.split("/")[0]!;
    if (!usedProviders.has(provider) && c.model !== primary) {
      chain.push(c.model);
      usedProviders.add(provider);
    }
  }

  return chain;
}

/** Load operator's routing preferences from SpacetimeDB. */
export async function getOperatorRouting(operatorId: string): Promise<RoutingPreference> {
  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT content FROM memory_document WHERE namespace = 'routing' AND agent_id = '${sqlEscape(operatorId)}' LIMIT 1`,
    )) as Record<string, unknown>[];

    if (rows.length > 0) {
      return JSON.parse(String(rows[0]!.content)) as RoutingPreference;
    }
  } catch { /* fall through */ }

  return { strategy: "balanced" };
}

/** Save operator's routing preferences. */
export async function saveOperatorRouting(operatorId: string, prefs: RoutingPreference): Promise<void> {
  const client = createControlClient();
  await client.callReducer("upsert_memory_document", [
    `routing_${operatorId}`,
    operatorId,
    "routing",
    "Provider Routing Preferences",
    JSON.stringify(prefs),
    "config",
    "{}",
  ]);
}

/** Get the provider catalog for display. */
export function getProviderCatalog(): ProviderConfig[] {
  return [...PROVIDER_CATALOG];
}
