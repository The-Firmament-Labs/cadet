import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireOperatorApiSession: vi.fn(),
  parseSessionFromRequest: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: vi.fn(),
}));

vi.mock("@/lib/token-store", () => ({
  storeVercelTokens: vi.fn(),
}));

vi.mock("@/lib/vercel-auth", () => ({
  refreshAccessToken: vi.fn(),
}));

import {
  requireOperatorApiSession,
  parseSessionFromRequest,
  setSessionCookie,
} from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { storeVercelTokens } from "@/lib/token-store";
import { refreshAccessToken } from "@/lib/vercel-auth";

import { POST } from "./route";

describe("POST /api/auth/vercel/refresh", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireOperatorApiSession).mockResolvedValue({
      unauthorized: null,
      authToken: undefined,
      operatorId: "op_123",
    });
    vi.mocked(parseSessionFromRequest).mockReturnValue({
      operatorId: "op_123",
      displayName: "Operator",
      email: "operator@example.com",
      role: "operator",
      vercelAccessToken: "old-access",
      vercelRefreshToken: "old-refresh",
      vercelTokenExpiresAt: Date.now() - 1,
    });
    vi.mocked(getServerEnv).mockReturnValue({
      vercelClientId: "vercel-client",
      vercelClientSecret: "vercel-secret",
    } as never);
  });

  it("persists refreshed Vercel tokens before updating the session cookie", async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: 3600,
      token_type: "Bearer",
    });

    const response = await POST(new Request("http://test/api/auth/vercel/refresh", {
      method: "POST",
      headers: { cookie: "cadet_session=test" },
    }));

    expect(response.status).toBe(200);
    expect(storeVercelTokens).toHaveBeenCalledWith(
      "op_123",
      "new-access",
      "new-refresh",
      expect.any(Number),
    );
    expect(setSessionCookie).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorId: "op_123",
        vercelAccessToken: "new-access",
        vercelRefreshToken: "new-refresh",
      }),
    );
  });

  it("reuses the existing refresh token when the provider does not rotate it", async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue({
      access_token: "new-access",
      expires_in: 900,
      token_type: "Bearer",
    });

    await POST(new Request("http://test/api/auth/vercel/refresh", {
      method: "POST",
      headers: { cookie: "cadet_session=test" },
    }));

    expect(storeVercelTokens).toHaveBeenCalledWith(
      "op_123",
      "new-access",
      "old-refresh",
      expect.any(Number),
    );
    expect(setSessionCookie).toHaveBeenCalledWith(
      expect.objectContaining({
        vercelRefreshToken: "old-refresh",
      }),
    );
  });
});
