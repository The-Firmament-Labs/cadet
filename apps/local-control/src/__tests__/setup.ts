import { vi } from "vitest";

// Provide a minimal Bun global so index.ts can call Bun.serve() at module load.
// The actual server is never started during tests — we test handleRequest directly.
(globalThis as unknown as Record<string, unknown>).Bun = {
  serve: vi.fn(() => ({ port: 3010 }))
};
