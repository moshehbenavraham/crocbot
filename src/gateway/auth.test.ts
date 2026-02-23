import { describe, expect, it } from "vitest";

import { authorizeGatewayConnect } from "./auth.js";
import { createAuthRateLimiter } from "./auth-rate-limit.js";

describe("gateway auth", () => {
  it("does not throw when req is missing socket", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "secret" },
      // Regression: avoid crashing on req.socket.remoteAddress when callers pass a non-IncomingMessage.
      req: {} as never,
    });
    expect(res.ok).toBe(true);
  });

  it("reports missing and mismatched token reasons", async () => {
    const missing = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: null,
    });
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe("token_missing");

    const mismatch = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: false },
      connectAuth: { token: "wrong" },
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toBe("token_mismatch");
  });

  it("reports missing token config reason", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", allowTailscale: false },
      connectAuth: { token: "anything" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("token_missing_config");
  });

  it("reports missing and mismatched password reasons", async () => {
    const missing = await authorizeGatewayConnect({
      auth: { mode: "password", password: "secret", allowTailscale: false },
      connectAuth: null,
    });
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe("password_missing");

    const mismatch = await authorizeGatewayConnect({
      auth: { mode: "password", password: "secret", allowTailscale: false },
      connectAuth: { password: "wrong" },
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toBe("password_mismatch");
  });

  it("reports missing password config reason", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "password", allowTailscale: false },
      connectAuth: { password: "secret" },
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("password_missing_config");
  });

  it("treats local tailscale serve hostnames as direct", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: true },
      connectAuth: { token: "secret" },
      req: {
        socket: { remoteAddress: "127.0.0.1" },
        headers: { host: "gateway.tailnet-1234.ts.net:443" },
      } as never,
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
  });

  it("allows tailscale identity to satisfy token mode auth", async () => {
    const res = await authorizeGatewayConnect({
      auth: { mode: "token", token: "secret", allowTailscale: true },
      connectAuth: null,
      tailscaleWhois: async () => ({ login: "peter", name: "Peter" }),
      req: {
        socket: { remoteAddress: "127.0.0.1" },
        headers: {
          host: "gateway.local",
          "x-forwarded-for": "100.64.0.1",
          "x-forwarded-proto": "https",
          "x-forwarded-host": "ai-hub.bone-egret.ts.net",
          "tailscale-user-login": "peter",
          "tailscale-user-name": "Peter",
        },
      } as never,
    });

    expect(res.ok).toBe(true);
    expect(res.method).toBe("tailscale");
    expect(res.user).toBe("peter");
  });

  it("uses timing-safe comparison (secretEqual) for tokens", async () => {
    const ok = await authorizeGatewayConnect({
      auth: { mode: "token", token: "abc123", allowTailscale: false },
      connectAuth: { token: "abc123" },
    });
    expect(ok.ok).toBe(true);

    const bad = await authorizeGatewayConnect({
      auth: { mode: "token", token: "abc123", allowTailscale: false },
      connectAuth: { token: "abc124" },
    });
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe("token_mismatch");
  });
});

describe("gateway auth rate limiting", () => {
  it("blocks auth after max failed attempts", async () => {
    const limiter = createAuthRateLimiter({
      maxAttempts: 3,
      windowMs: 60_000,
      lockoutMs: 300_000,
      exemptLoopback: false,
      pruneIntervalMs: 0,
    });

    const auth = { mode: "token" as const, token: "secret", allowTailscale: false };
    const clientIp = "192.168.1.100";

    for (let i = 0; i < 3; i++) {
      const res = await authorizeGatewayConnect({
        auth,
        connectAuth: { token: "wrong" },
        rateLimiter: limiter,
        clientIp,
      });
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("token_mismatch");
    }

    const blocked = await authorizeGatewayConnect({
      auth,
      connectAuth: { token: "secret" },
      rateLimiter: limiter,
      clientIp,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe("rate_limited");
    expect(blocked.rateLimited).toBe(true);
    expect(typeof blocked.retryAfterMs).toBe("number");

    limiter.dispose();
  });

  it("resets rate limit counter on successful auth", async () => {
    const limiter = createAuthRateLimiter({
      maxAttempts: 3,
      windowMs: 60_000,
      lockoutMs: 300_000,
      exemptLoopback: false,
      pruneIntervalMs: 0,
    });

    const auth = { mode: "token" as const, token: "secret", allowTailscale: false };
    const clientIp = "192.168.1.101";

    // Record 2 failures (under limit)
    for (let i = 0; i < 2; i++) {
      await authorizeGatewayConnect({
        auth,
        connectAuth: { token: "wrong" },
        rateLimiter: limiter,
        clientIp,
      });
    }

    // Succeed -- should reset counter
    const ok = await authorizeGatewayConnect({
      auth,
      connectAuth: { token: "secret" },
      rateLimiter: limiter,
      clientIp,
    });
    expect(ok.ok).toBe(true);

    // 2 more failures should NOT trigger lockout (counter was reset)
    for (let i = 0; i < 2; i++) {
      const res = await authorizeGatewayConnect({
        auth,
        connectAuth: { token: "wrong" },
        rateLimiter: limiter,
        clientIp,
      });
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("token_mismatch");
    }

    limiter.dispose();
  });

  it("does not rate limit when no limiter is provided", async () => {
    const auth = { mode: "token" as const, token: "secret", allowTailscale: false };

    for (let i = 0; i < 20; i++) {
      const res = await authorizeGatewayConnect({
        auth,
        connectAuth: { token: "wrong" },
      });
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("token_mismatch");
    }
  });
});
