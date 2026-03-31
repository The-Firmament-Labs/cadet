/**
 * Tests for apps/web/lib/agent-runtime/provider-routing.ts
 *
 * Strategy:
 *   - selectModel: strategy-based selection (cost, speed, quality, balanced).
 *   - selectModel: blocked providers, preferred providers, maxCostTier filter.
 *   - selectModel: falls back to hardcoded model when no candidates remain.
 *   - buildFallbackChain: primary is first, fallbacks are from different providers.
 *   - buildFallbackChain: respects maxFallbacks limit.
 *   - getProviderCatalog: returns all providers as a copy.
 *
 *   createControlClient is mocked because provider-routing.ts imports server.ts
 *   (for getOperatorRouting / saveOperatorRouting, which we don't test here).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock: @/lib/server (used by getOperatorRouting / saveOperatorRouting)
// ---------------------------------------------------------------------------

const mockClient = {
  sql: vi.fn(),
  callReducer: vi.fn(),
};

vi.mock("@/lib/server", () => ({
  createControlClient: vi.fn(() => mockClient),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { selectModel, buildFallbackChain, getProviderCatalog } from "./provider-routing";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getProviderCatalog
// ---------------------------------------------------------------------------

describe("getProviderCatalog", () => {
  it("returns an array of provider configs", () => {
    const catalog = getProviderCatalog();
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
  });

  it("every entry has a model string in 'provider/model' format", () => {
    for (const p of getProviderCatalog()) {
      expect(p.model).toMatch(/^[a-z0-9-]+\/.+/);
    }
  });

  it("every entry has numeric costTier, speedTier, qualityTier", () => {
    for (const p of getProviderCatalog()) {
      expect(typeof p.costTier).toBe("number");
      expect(typeof p.speedTier).toBe("number");
      expect(typeof p.qualityTier).toBe("number");
    }
  });

  it("returns a copy (modifying the result does not affect subsequent calls)", () => {
    const catalog1 = getProviderCatalog();
    catalog1.length = 0; // truncate the copy
    const catalog2 = getProviderCatalog();
    expect(catalog2.length).toBeGreaterThan(0);
  });

  it("includes providers from anthropic, openai, google, deepseek, and xai", () => {
    const models = getProviderCatalog().map((p) => p.model);
    expect(models.some((m) => m.startsWith("anthropic/"))).toBe(true);
    expect(models.some((m) => m.startsWith("openai/"))).toBe(true);
    expect(models.some((m) => m.startsWith("google/"))).toBe(true);
    expect(models.some((m) => m.startsWith("deepseek/"))).toBe(true);
    expect(models.some((m) => m.startsWith("xai/"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// selectModel — strategy: cost
// ---------------------------------------------------------------------------

describe("selectModel — cost strategy", () => {
  it("returns a costTier=1 model for 'cost' strategy", () => {
    const model = selectModel({ strategy: "cost" });
    const catalog = getProviderCatalog();
    const selected = catalog.find((p) => p.model === model)!;
    expect(selected).toBeDefined();
    expect(selected.costTier).toBe(1);
  });

  it("returns the globally cheapest model overall", () => {
    const model = selectModel({ strategy: "cost" });
    const catalog = getProviderCatalog();
    const minCost = Math.min(...catalog.map((p) => p.costTier));
    const selected = catalog.find((p) => p.model === model)!;
    expect(selected.costTier).toBe(minCost);
  });
});

// ---------------------------------------------------------------------------
// selectModel — strategy: speed
// ---------------------------------------------------------------------------

describe("selectModel — speed strategy", () => {
  it("returns a speedTier=1 model for 'speed' strategy", () => {
    const model = selectModel({ strategy: "speed" });
    const catalog = getProviderCatalog();
    const selected = catalog.find((p) => p.model === model)!;
    expect(selected).toBeDefined();
    expect(selected.speedTier).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// selectModel — strategy: quality
// ---------------------------------------------------------------------------

describe("selectModel — quality strategy", () => {
  it("returns a qualityTier=1 model for 'quality' strategy", () => {
    const model = selectModel({ strategy: "quality" });
    const catalog = getProviderCatalog();
    const selected = catalog.find((p) => p.model === model)!;
    expect(selected).toBeDefined();
    expect(selected.qualityTier).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// selectModel — blocked providers
// ---------------------------------------------------------------------------

describe("selectModel — blocked providers", () => {
  it("does not return a blocked model", () => {
    // Block Claude Sonnet — which is usually a top candidate
    const model = selectModel({
      strategy: "quality",
      blocked: ["anthropic/claude-sonnet-4.5"],
    });
    expect(model).not.toBe("anthropic/claude-sonnet-4.5");
  });

  it("can block multiple providers and still return a valid model", () => {
    const model = selectModel({
      strategy: "cost",
      blocked: ["anthropic/claude-haiku-4.5", "openai/gpt-5.4-mini"],
    });
    expect(model).toBeTruthy();
    expect(model).not.toBe("anthropic/claude-haiku-4.5");
    expect(model).not.toBe("openai/gpt-5.4-mini");
  });

  it("falls back to hardcoded model when all candidates are blocked", () => {
    const allModels = getProviderCatalog().map((p) => p.model);
    const model = selectModel({
      strategy: "cost",
      blocked: allModels,
    });
    // Should return the safe fallback
    expect(model).toBe("anthropic/claude-sonnet-4.5");
  });
});

// ---------------------------------------------------------------------------
// selectModel — preferred providers
// ---------------------------------------------------------------------------

describe("selectModel — preferred providers", () => {
  it("puts preferred models first when they exist", () => {
    // DeepSeek R1 is rarely the top cost pick without preference
    const model = selectModel({
      strategy: "quality",
      preferred: ["deepseek/deepseek-r1"],
    });
    expect(model).toBe("deepseek/deepseek-r1");
  });

  it("falls back to strategy selection when preferred model is blocked", () => {
    const model = selectModel({
      strategy: "cost",
      preferred: ["anthropic/claude-sonnet-4.5"],
      blocked: ["anthropic/claude-sonnet-4.5"],
    });
    // Preferred is blocked so cannot be selected; another should come through
    expect(model).not.toBe("anthropic/claude-sonnet-4.5");
    expect(model).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// selectModel — maxCostTier
// ---------------------------------------------------------------------------

describe("selectModel — maxCostTier", () => {
  it("filters out models above the maxCostTier", () => {
    // With maxCostTier=1, no tier-2 or tier-3 models should be selected
    const model = selectModel({ strategy: "quality", maxCostTier: 1 });
    const catalog = getProviderCatalog();
    const selected = catalog.find((p) => p.model === model)!;
    expect(selected.costTier).toBeLessThanOrEqual(1);
  });

  it("falls back to hardcoded model when maxCostTier filters everything", () => {
    // maxCostTier=0 should eliminate all models (all tiers >= 1)
    const model = selectModel({ strategy: "cost", maxCostTier: 0 });
    expect(model).toBe("anthropic/claude-sonnet-4.5");
  });
});

// ---------------------------------------------------------------------------
// selectModel — required capabilities
// ---------------------------------------------------------------------------

describe("selectModel — requiredCapabilities", () => {
  it("selects a model that has the 'vision' capability", () => {
    const model = selectModel({ strategy: "cost" }, ["vision"]);
    const catalog = getProviderCatalog();
    const selected = catalog.find((p) => p.model === model)!;
    expect(selected.capabilities).toContain("vision");
  });

  it("falls back to hardcoded model when no model has all required capabilities", () => {
    const model = selectModel({ strategy: "cost" }, ["teleportation"]);
    expect(model).toBe("anthropic/claude-sonnet-4.5");
  });
});

// ---------------------------------------------------------------------------
// buildFallbackChain
// ---------------------------------------------------------------------------

describe("buildFallbackChain — basic", () => {
  it("returns an array with at least one element (the primary)", () => {
    const chain = buildFallbackChain({ strategy: "quality" });
    expect(chain.length).toBeGreaterThanOrEqual(1);
  });

  it("first element is the primary model from selectModel", () => {
    const primary = selectModel({ strategy: "cost" });
    const chain = buildFallbackChain({ strategy: "cost" });
    expect(chain[0]).toBe(primary);
  });

  it("subsequent elements are from different providers than the primary", () => {
    const chain = buildFallbackChain({ strategy: "quality" });
    if (chain.length > 1) {
      const primaryProvider = chain[0]!.split("/")[0];
      for (const fallback of chain.slice(1)) {
        const fallbackProvider = fallback.split("/")[0];
        expect(fallbackProvider).not.toBe(primaryProvider);
      }
    }
  });

  it("all models in the chain are unique", () => {
    const chain = buildFallbackChain({ strategy: "quality" });
    const unique = new Set(chain);
    expect(unique.size).toBe(chain.length);
  });
});

describe("buildFallbackChain — maxFallbacks", () => {
  it("respects maxFallbacks=1 (returns only the primary)", () => {
    const chain = buildFallbackChain({ strategy: "quality" }, undefined, 1);
    expect(chain).toHaveLength(1);
  });

  it("respects maxFallbacks=2 (at most 2 models)", () => {
    const chain = buildFallbackChain({ strategy: "quality" }, undefined, 2);
    expect(chain.length).toBeLessThanOrEqual(2);
  });

  it("defaults to at most 3 models when maxFallbacks not specified", () => {
    const chain = buildFallbackChain({ strategy: "quality" });
    expect(chain.length).toBeLessThanOrEqual(3);
  });
});

describe("buildFallbackChain — with blocked providers", () => {
  it("excludes blocked models from the fallback chain", () => {
    const chain = buildFallbackChain({
      strategy: "quality",
      blocked: ["openai/gpt-5.4"],
    });
    expect(chain).not.toContain("openai/gpt-5.4");
  });
});

describe("buildFallbackChain — with required capabilities", () => {
  it("all models in chain support the required capability", () => {
    const chain = buildFallbackChain({ strategy: "cost" }, ["vision"]);
    const catalog = getProviderCatalog();
    for (const model of chain) {
      const entry = catalog.find((p) => p.model === model);
      // entry may be undefined for the hardcoded fallback; skip those
      if (entry) {
        expect(entry.capabilities).toContain("vision");
      }
    }
  });
});
