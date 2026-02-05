import { describe, expect, it, vi } from "vitest";

import { fetchWithSsrFGuard } from "./fetch-guard.js";
import { SsrFBlockedError } from "./ssrf.js";
import type { LookupFn } from "./ssrf.js";

function publicLookup(): LookupFn {
  return vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
}

function privateLookup(): LookupFn {
  return vi.fn(async () => [{ address: "10.0.0.1", family: 4 }]);
}

function makeFetch(
  responses: Array<{ status: number; headers?: Record<string, string>; body?: string }>,
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  let callIndex = 0;
  return vi.fn(async () => {
    const spec = responses[callIndex] ?? responses[responses.length - 1];
    callIndex += 1;
    const headers = new Headers(spec.headers);
    return new Response(spec.body ?? "", {
      status: spec.status,
      headers,
    });
  });
}

describe("fetchWithSsrFGuard", () => {
  it("fetches a public URL successfully", async () => {
    const fetchImpl = makeFetch([{ status: 200, body: "ok" }]);
    const result = await fetchWithSsrFGuard({
      url: "https://example.com/data",
      fetchImpl,
      lookupFn: publicLookup(),
      pinDns: false,
    });
    expect(result.response.status).toBe(200);
    expect(result.finalUrl).toBe("https://example.com/data");
    const text = await result.response.text();
    expect(text).toBe("ok");
    await result.release();
  });

  it("blocks private IP in initial URL", async () => {
    const fetchImpl = makeFetch([{ status: 200 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://10.0.0.1/secret",
        fetchImpl,
        lookupFn: publicLookup(),
      }),
    ).rejects.toThrow(SsrFBlockedError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks private IP after DNS resolution", async () => {
    const fetchImpl = makeFetch([{ status: 200 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://evil.example.com/secret",
        fetchImpl,
        lookupFn: privateLookup(),
      }),
    ).rejects.toThrow(SsrFBlockedError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks redirect to private IP at hop", async () => {
    let callCount = 0;
    const lookupFn: LookupFn = vi.fn(async (_hostname: string) => {
      callCount += 1;
      if (callCount === 1) {
        return [{ address: "93.184.216.34", family: 4 }];
      }
      return [{ address: "10.0.0.1", family: 4 }];
    });
    const fetchImpl = makeFetch([
      { status: 302, headers: { location: "https://internal.evil.com/steal" } },
    ]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://example.com/redirect",
        fetchImpl,
        lookupFn,
        pinDns: false,
      }),
    ).rejects.toThrow(SsrFBlockedError);
  });

  it("detects redirect loop (URL visited twice)", async () => {
    const fetchImpl = makeFetch([
      { status: 302, headers: { location: "https://example.com/b" } },
      { status: 302, headers: { location: "https://example.com/b" } },
    ]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://example.com/a",
        fetchImpl,
        lookupFn: publicLookup(),
        pinDns: false,
      }),
    ).rejects.toThrow("Redirect loop detected");
  });

  it("enforces max redirect limit", async () => {
    const fetchImpl = makeFetch([
      { status: 302, headers: { location: "https://example.com/r1" } },
      { status: 302, headers: { location: "https://example.com/r2" } },
      { status: 302, headers: { location: "https://example.com/r3" } },
      { status: 302, headers: { location: "https://example.com/r4" } },
    ]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://example.com/start",
        fetchImpl,
        lookupFn: publicLookup(),
        maxRedirects: 2,
        pinDns: false,
      }),
    ).rejects.toThrow("Too many redirects");
  });

  it("timeout fires and aborts request", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 5000);
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        });
        return new Response("should not reach");
      },
    );

    await expect(
      fetchWithSsrFGuard({
        url: "https://example.com/slow",
        fetchImpl,
        lookupFn: publicLookup(),
        timeoutMs: 50,
        pinDns: false,
      }),
    ).rejects.toThrow("aborted");
  });

  it("external AbortSignal composes with timeout", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 5000);
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        });
        return new Response("should not reach");
      },
    );

    setTimeout(() => controller.abort(), 30);

    await expect(
      fetchWithSsrFGuard({
        url: "https://example.com/slow",
        fetchImpl,
        lookupFn: publicLookup(),
        signal: controller.signal,
        timeoutMs: 10_000,
        pinDns: false,
      }),
    ).rejects.toThrow("aborted");
  });

  it("rejects invalid protocol (ftp:)", async () => {
    const fetchImpl = makeFetch([{ status: 200 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "ftp://example.com/file",
        fetchImpl,
        lookupFn: publicLookup(),
      }),
    ).rejects.toThrow("Invalid URL: must be http or https");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects invalid protocol (file:)", async () => {
    const fetchImpl = makeFetch([{ status: 200 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "file:///etc/passwd",
        fetchImpl,
        lookupFn: publicLookup(),
      }),
    ).rejects.toThrow("Invalid URL: must be http or https");
  });

  it("release() cleans up without error", async () => {
    const fetchImpl = makeFetch([{ status: 200, body: "data" }]);
    const result = await fetchWithSsrFGuard({
      url: "https://example.com/ok",
      fetchImpl,
      lookupFn: publicLookup(),
      pinDns: false,
    });

    await result.release();
    // calling release() a second time should be a no-op
    await result.release();
  });

  it("finalUrl tracks through redirects", async () => {
    const fetchImpl = makeFetch([
      { status: 302, headers: { location: "https://example.com/step2" } },
      { status: 302, headers: { location: "https://example.com/final" } },
      { status: 200, body: "done" },
    ]);
    const result = await fetchWithSsrFGuard({
      url: "https://example.com/start",
      fetchImpl,
      lookupFn: publicLookup(),
      pinDns: false,
    });
    expect(result.finalUrl).toBe("https://example.com/final");
    expect(result.response.status).toBe(200);
    await result.release();
  });

  it("throws on redirect with missing Location header", async () => {
    const fetchImpl = makeFetch([{ status: 302 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://example.com/redir",
        fetchImpl,
        lookupFn: publicLookup(),
        pinDns: false,
      }),
    ).rejects.toThrow("Redirect missing location header");
  });

  it("passes init options through to fetch", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    const result = await fetchWithSsrFGuard({
      url: "https://example.com/post",
      fetchImpl,
      lookupFn: publicLookup(),
      pinDns: false,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"key":"value"}',
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const callArgs = fetchImpl.mock.calls[0];
    const init = callArgs[1] as Record<string, unknown>;
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    await result.release();
  });
});
