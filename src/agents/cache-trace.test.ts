import type { StreamFn } from "@earendil-works/pi-agent-core";
import { describe, expect, it } from "vitest";

import type { crocbotConfig } from "../config/config.js";
import { resolveUserPath } from "../utils.js";
import {
  createCacheTrace,
  isCredentialHeaderValue,
  isSensitiveHeaderName,
  redactTraceOptions,
} from "./cache-trace.js";

describe("createCacheTrace", () => {
  it("returns null when diagnostics cache tracing is disabled", () => {
    const trace = createCacheTrace({
      cfg: {} as crocbotConfig,
      env: {},
    });

    expect(trace).toBeNull();
  });

  it("honors diagnostics cache trace config and expands file paths", () => {
    const lines: string[] = [];
    const trace = createCacheTrace({
      cfg: {
        diagnostics: {
          cacheTrace: {
            enabled: true,
            filePath: "~/.crocbot/logs/cache-trace.jsonl",
          },
        },
      },
      env: {},
      writer: {
        filePath: "memory",
        write: (line) => lines.push(line),
      },
    });

    expect(trace).not.toBeNull();
    expect(trace?.filePath).toBe(resolveUserPath("~/.crocbot/logs/cache-trace.jsonl"));

    trace?.recordStage("session:loaded", {
      messages: [],
      system: "sys",
    });

    expect(lines.length).toBe(1);
  });

  it("records empty prompt/system values when enabled", () => {
    const lines: string[] = [];
    const trace = createCacheTrace({
      cfg: {
        diagnostics: {
          cacheTrace: {
            enabled: true,
            includePrompt: true,
            includeSystem: true,
          },
        },
      },
      env: {},
      writer: {
        filePath: "memory",
        write: (line) => lines.push(line),
      },
    });

    trace?.recordStage("prompt:before", { prompt: "", system: "" });

    const event = JSON.parse(lines[0]?.trim() ?? "{}") as Record<string, unknown>;
    expect(event.prompt).toBe("");
    expect(event.system).toBe("");
  });

  it("respects env overrides for enablement", () => {
    const lines: string[] = [];
    const trace = createCacheTrace({
      cfg: {
        diagnostics: {
          cacheTrace: {
            enabled: true,
          },
        },
      },
      env: {
        CROCBOT_CACHE_TRACE: "0",
      },
      writer: {
        filePath: "memory",
        write: (line) => lines.push(line),
      },
    });

    expect(trace).toBeNull();
  });

  it("redacts apiKey, auth headers and provider env from recorded stream options", async () => {
    const lines: string[] = [];
    const trace = createCacheTrace({
      cfg: { diagnostics: { cacheTrace: { enabled: true } } },
      env: {},
      writer: {
        filePath: "memory",
        write: (line) => lines.push(line),
      },
    });
    const seen: unknown[] = [];
    const streamFn = trace?.wrapStreamFn(((_model, _context, options) => {
      seen.push(options);
      return undefined as never;
    }) as StreamFn);
    const options = {
      apiKey: "sk-secret-value",
      maxTokens: 10,
      headers: {
        Authorization: "Bearer sk-secret-value",
        "x-api-key": "sk-secret-value",
        "x-goog-api-key": "sk-secret-value",
        "Proxy-Authorization": "Basic c2VjcmV0",
        Cookie: "session=secret",
        "User-Agent": "KimiCLI/0.77",
        "anthropic-beta": "prompt-caching",
      },
      env: { AWS_SECRET_ACCESS_KEY: "secret-env" },
    };
    await streamFn?.(
      { id: "m", provider: "p", api: "openai-completions" } as never,
      { messages: [] } as never,
      options as never,
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("sk-secret-value");
    expect(lines[0]).not.toContain("c2VjcmV0");
    expect(lines[0]).not.toContain("session=secret");
    expect(lines[0]).not.toContain("secret-env");
    const event = JSON.parse(lines[0] ?? "{}") as { options: Record<string, unknown> };
    expect(event.options.apiKey).toBe("[REDACTED]");
    expect(event.options.maxTokens).toBe(10);
    expect(event.options.headers).toEqual({
      Authorization: "[REDACTED]",
      "x-api-key": "[REDACTED]",
      "x-goog-api-key": "[REDACTED]",
      "Proxy-Authorization": "[REDACTED]",
      Cookie: "[REDACTED]",
      "User-Agent": "KimiCLI/0.77",
      "anthropic-beta": "prompt-caching",
    });
    expect(event.options.env).toEqual({ AWS_SECRET_ACCESS_KEY: "[REDACTED]" });
    // The wrapped stream function still receives the real credentials.
    expect(seen[0]).toBe(options);
  });

  it("redacts subscription-key headers, array header values, tuple and Headers forms", async () => {
    const lines: string[] = [];
    const trace = createCacheTrace({
      cfg: { diagnostics: { cacheTrace: { enabled: true } } },
      env: {},
      writer: {
        filePath: "memory",
        write: (line) => lines.push(line),
      },
    });
    const streamFn = trace?.wrapStreamFn((() => undefined as never) as StreamFn);
    const record = async (headers: unknown) => {
      await streamFn?.(
        { id: "m", provider: "p", api: "openai-completions" } as never,
        { messages: [] } as never,
        { headers } as never,
      );
      const line = lines.at(-1) ?? "{}";
      expect(line).not.toContain("sk-secret-value");
      return (JSON.parse(line) as { options: { headers: unknown } }).options.headers;
    };

    expect(
      await record({
        "Ocp-Apim-Subscription-Key": "sk-secret-value",
        "x-functions-key": "sk-secret-value",
        Authorization: ["Bearer sk-secret-value", "Basic sk-secret-value"],
        "X-Upstream": ["Bearer sk-secret-value", "plain"],
        "X-Custom-Auth": "Basic sk-secret-value",
        Accept: ["application/json", "text/plain"],
      }),
    ).toEqual({
      "Ocp-Apim-Subscription-Key": "[REDACTED]",
      "x-functions-key": "[REDACTED]",
      Authorization: ["[REDACTED]", "[REDACTED]"],
      "X-Upstream": ["[REDACTED]", "plain"],
      "X-Custom-Auth": "[REDACTED]",
      Accept: ["application/json", "text/plain"],
    });

    expect(
      await record([
        ["Authorization", "Bearer sk-secret-value"],
        ["ocp-apim-subscription-key", "sk-secret-value"],
        ["User-Agent", "KimiCLI/0.77"],
      ]),
    ).toEqual([
      ["Authorization", "[REDACTED]"],
      ["ocp-apim-subscription-key", "[REDACTED]"],
      ["User-Agent", "KimiCLI/0.77"],
    ]);

    expect(
      await record(
        new Headers({ Authorization: "Bearer sk-secret-value", "User-Agent": "KimiCLI/0.77" }),
      ),
    ).toEqual({ authorization: "[REDACTED]", "user-agent": "KimiCLI/0.77" });
  });

  it("redacts unknown auth-like header names and Token/Digest schemes", () => {
    const secret = "SECRETVAL123";
    const options = {
      headers: {
        "X-Raw-Auth": secret,
        "X-Auth": `Token ${secret}`,
        "X-Upstream-Authorization": `Digest username="u", realm="r", nonce="n", response="${secret}"`,
        "X-Client-Secret": secret,
        "X-Db-Password": secret,
        "X-Amz-Security-Token": secret,
        "Set-Cookie": [`sid=${secret}`, `other=${secret}`],
        xApiKey: secret,
        "X-Forward": `Token ${secret}`,
        "X-Neutral": `Digest username="u", response="${secret}"`,
        "X-Aws": `AWS4-HMAC-SHA256 Credential=AKIA/x, Signature=${secret}`,
        // Must stay readable:
        "X-Max-Tokens": "100",
        "X-Plan": "Basic plan",
        "X-Mode": "bearer-less",
        "X-Kind": "Token",
        "Keep-Alive": "timeout=5",
        "anthropic-beta": "token-efficient-tools-2025-02-19",
        "X-Request-Id": "req-42",
        "X-Stainless-Retry-Count": "0",
        "OpenAI-Organization": "org-1",
        "X-Path": "/v1/messages",
      },
    };
    const snapshot = JSON.stringify(options);
    const out = redactTraceOptions(options);
    expect(JSON.stringify(options)).toBe(snapshot);
    expect(JSON.stringify(out)).not.toContain(secret);
    expect(out.headers).toEqual({
      "X-Raw-Auth": "[REDACTED]",
      "X-Auth": "[REDACTED]",
      "X-Upstream-Authorization": "[REDACTED]",
      "X-Client-Secret": "[REDACTED]",
      "X-Db-Password": "[REDACTED]",
      "X-Amz-Security-Token": "[REDACTED]",
      "Set-Cookie": ["[REDACTED]", "[REDACTED]"],
      xApiKey: "[REDACTED]",
      "X-Forward": "[REDACTED]",
      "X-Neutral": "[REDACTED]",
      "X-Aws": "[REDACTED]",
      "X-Max-Tokens": "100",
      "X-Plan": "Basic plan",
      "X-Mode": "bearer-less",
      "X-Kind": "Token",
      "Keep-Alive": "timeout=5",
      "anthropic-beta": "token-efficient-tools-2025-02-19",
      "X-Request-Id": "req-42",
      "X-Stainless-Retry-Count": "0",
      "OpenAI-Organization": "org-1",
      "X-Path": "/v1/messages",
    });
  });

  // Regressions from the #30 review: each of these leaked through the
  // whole-word matcher in c86f81c3e while main (or the reviewer) redacts them.
  it.each([
    "X-Apitoken",
    "X-Secretkey",
    "X-Accesskey",
    "X-Passphrase",
    "X-Authz",
    "X-Pass",
    "X-Jwt",
    "X-Pat",
    "X-Hmac",
    "X-Sig",
    "X-Bearer",
    "X-OTP",
    "xPat",
  ])("redacts compound/short credential header name %s", (name) => {
    const secret = "SECRETVAL123";
    expect(isSensitiveHeaderName(name)).toBe(true);
    const out = redactTraceOptions({ headers: { [name]: secret } });
    expect(out.headers).toEqual({ [name]: "[REDACTED]" });
  });

  it.each([
    ["Basic with a short user:pass payload", "Basic YTpi"],
    ["Basic with a longer user:pass payload", "Basic dTpwYXNz"],
    ["short Bearer", "Bearer short"],
    ["Bearer with a colon", "Bearer abc:SECRETVAL123"],
    ["Bearer then Basic comma list", "Bearer SECRETVAL123, Basic SECRETVAL123"],
    ["Bearer later in a comma list", "Token x, Bearer SECRETVAL123"],
    ["Basic later in a comma list", "foo, Basic YTpi"],
    ["lowercase bearer with a tab", "bearer\tSECRETVAL123"],
    ["Rails Token param form", 'Token token="SECRETVAL123"'],
    ["bare token param", 'token="SECRETVAL123"'],
    ["access_token param", "access_token=SECRETVAL123"],
    ["HOBA", "HOBA SECRETVAL123"],
    ["scheme-less sk- key", "sk-ant-api03-AbCdEf0123456789_xyz"],
    ["scheme-less JWT", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl"],
  ])("redacts credential value under a neutral name: %s", (_label, value) => {
    expect(isCredentialHeaderValue(value)).toBe(true);
    expect(redactTraceOptions({ headers: { "X-Fwd": value } }).headers).toEqual({
      "X-Fwd": "[REDACTED]",
    });
  });

  it("keeps clearly non-credential values and token-count headers readable", () => {
    for (const value of [
      "Basic plan",
      "Basic usage of thing",
      "Token",
      "Digest",
      "bearer-less",
      "Bearer",
      "application/json",
      "assistants=v2",
      "token-efficient-tools-2025-02-19",
      "desk-lamp",
    ]) {
      expect(isCredentialHeaderValue(value), value).toBe(false);
    }
    const counts = {
      "X-Max-Tokens": "100",
      "X-Token-Count": "12",
      "X-Tokens-Remaining": "12",
      "X-Ratelimit-Remaining-Tokens": "1000",
    };
    expect(redactTraceOptions({ headers: counts }).headers).toEqual(counts);
    // The count exemption never applies to non-integers or other sensitive words.
    expect(
      redactTraceOptions({
        headers: {
          "X-Max-Tokens": "SECRETVAL123",
          "X-Auth-Token-Count": "12",
          "X-Token": "12",
          "X-Session-Token-Limit": "5",
        },
      }).headers,
    ).toEqual({
      "X-Max-Tokens": "[REDACTED]",
      "X-Auth-Token-Count": "[REDACTED]",
      "X-Token": "[REDACTED]",
      "X-Session-Token-Limit": "[REDACTED]",
    });
  });

  it("stays linear on adversarial header names and values (ReDoS guard)", () => {
    const n = 1_000_000;
    const inputs = [
      "Bearer " + "a".repeat(n) + "!",
      "bearer" + " ".repeat(n),
      " token" + " ".repeat(n) + "x",
      "eyJ".repeat(n / 3),
      ("-eyJ" + "a".repeat(20)).repeat(n / 24),
      " sk-a".repeat(n / 5),
      ",".repeat(n),
      "Basic " + "A".repeat(n) + "!",
      "Digest " + "a".repeat(n),
      " ".repeat(n) + "x",
    ];
    const start = performance.now();
    for (const value of inputs) {
      isCredentialHeaderValue(value);
    }
    isSensitiveHeaderName("aB".repeat(n / 2));
    redactTraceOptions({ headers: { ["max-" + "token".repeat(n / 5)]: "5" } });
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it("keeps Map header casing; fetch Headers names are lowercase per the Fetch spec", () => {
    const secret = "SECRETVAL123";
    expect(
      redactTraceOptions({
        headers: new Map([
          ["X-Raw-Auth", secret],
          ["Content-Type", "application/json"],
        ]),
      }).headers,
    ).toEqual({ "X-Raw-Auth": "[REDACTED]", "Content-Type": "application/json" });
    expect(
      redactTraceOptions({
        headers: new Headers({ "X-Raw-Auth": secret, "X-Max-Tokens": "100" }),
      }).headers,
    ).toEqual({ "x-raw-auth": "[REDACTED]", "x-max-tokens": "100" });
  });
});
