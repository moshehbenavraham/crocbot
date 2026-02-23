import { describe, expect, it, vi } from "vitest";

import { fetchWithSsrFGuard } from "./fetch-guard.js";
import { isPrivateIpAddress, SsrFBlockedError } from "./ssrf.js";
import type { LookupFn } from "./ssrf.js";

// ---------------------------------------------------------------------------
// DNS mock helpers
// ---------------------------------------------------------------------------

/** Return a LookupFn that always resolves to the given addresses. */
function staticLookup(addresses: Array<{ address: string; family: number }>): LookupFn {
  return vi.fn(async () => addresses);
}

/**
 * Return a LookupFn that resolves to different addresses per call.
 * Useful for simulating redirect chains where DNS returns public on
 * first hop then private on second.
 */
function sequenceLookup(sequence: Array<Array<{ address: string; family: number }>>): LookupFn {
  let index = 0;
  return vi.fn(async () => {
    const result = sequence[index] ?? sequence[sequence.length - 1];
    index += 1;
    return result;
  });
}

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

type MockResponseSpec = {
  status: number;
  headers?: Record<string, string>;
  body?: string;
};

/** Build a mock fetch that returns responses in order. */
function mockFetch(
  specs: MockResponseSpec[],
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  let callIndex = 0;
  return vi.fn(async () => {
    const spec = specs[callIndex] ?? specs[specs.length - 1];
    callIndex += 1;
    return new Response(spec.body ?? "", {
      status: spec.status,
      headers: new Headers(spec.headers),
    });
  });
}

// ---------------------------------------------------------------------------
// SSRF integration tests: private IP ranges via mocked DNS
// ---------------------------------------------------------------------------

describe("SSRF integration: private IP range blocking via DNS", () => {
  const privateIpCases: Array<[string, string, number]> = [
    ["10.0.0.1 (Class A private)", "10.0.0.1", 4],
    ["10.255.255.255 (Class A boundary)", "10.255.255.255", 4],
    ["172.16.0.1 (Class B private start)", "172.16.0.1", 4],
    ["172.31.255.254 (Class B private end)", "172.31.255.254", 4],
    ["192.168.0.1 (Class C private)", "192.168.0.1", 4],
    ["192.168.255.254 (Class C boundary)", "192.168.255.254", 4],
    ["127.0.0.1 (loopback)", "127.0.0.1", 4],
    ["127.0.0.2 (alternate loopback)", "127.0.0.2", 4],
  ];

  it.each(privateIpCases)("blocks DNS resolving to %s", async (_label, address, family) => {
    const fetchImpl = mockFetch([{ status: 200 }]);
    const lookup = staticLookup([{ address, family }]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://attacker.example.com/steal",
        fetchImpl,
        lookupFn: lookup,
        pinDns: false,
      }),
    ).rejects.toThrow(SsrFBlockedError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SSRF integration tests: localhost and link-local
// ---------------------------------------------------------------------------

describe("SSRF integration: localhost and link-local blocking", () => {
  it("blocks DNS resolving to 169.254.0.1 (link-local)", async () => {
    const fetchImpl = mockFetch([{ status: 200 }]);
    const lookup = staticLookup([{ address: "169.254.0.1", family: 4 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://attacker.example.com/metadata",
        fetchImpl,
        lookupFn: lookup,
        pinDns: false,
      }),
    ).rejects.toThrow(SsrFBlockedError);
  });

  it("blocks DNS resolving to 169.254.169.254 (cloud metadata)", async () => {
    const fetchImpl = mockFetch([{ status: 200 }]);
    const lookup = staticLookup([{ address: "169.254.169.254", family: 4 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://attacker.example.com/imds",
        fetchImpl,
        lookupFn: lookup,
        pinDns: false,
      }),
    ).rejects.toThrow(SsrFBlockedError);
  });

  it("blocks URL with literal localhost hostname", async () => {
    const fetchImpl = mockFetch([{ status: 200 }]);
    const lookup = staticLookup([{ address: "127.0.0.1", family: 4 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://localhost/admin",
        fetchImpl,
        lookupFn: lookup,
        pinDns: false,
      }),
    ).rejects.toThrow(SsrFBlockedError);
  });

  it("blocks URL with .localhost subdomain", async () => {
    const fetchImpl = mockFetch([{ status: 200 }]);
    const lookup = staticLookup([{ address: "127.0.0.1", family: 4 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://evil.localhost/steal",
        fetchImpl,
        lookupFn: lookup,
        pinDns: false,
      }),
    ).rejects.toThrow(SsrFBlockedError);
  });

  it("blocks 100.64.0.1 (CGN / shared address space)", async () => {
    const fetchImpl = mockFetch([{ status: 200 }]);
    const lookup = staticLookup([{ address: "100.64.0.1", family: 4 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://attacker.example.com/cgn",
        fetchImpl,
        lookupFn: lookup,
        pinDns: false,
      }),
    ).rejects.toThrow(SsrFBlockedError);
  });
});

// ---------------------------------------------------------------------------
// SSRF integration tests: redirect chain validation
// ---------------------------------------------------------------------------

describe("SSRF integration: redirect chain validation", () => {
  it("blocks public -> public -> private redirect chain", async () => {
    const lookup = sequenceLookup([
      [{ address: "93.184.216.34", family: 4 }], // first hop: public
      [{ address: "93.184.216.35", family: 4 }], // second hop: public
      [{ address: "10.0.0.1", family: 4 }], // third hop: private
    ]);
    const fetchImpl = mockFetch([
      { status: 302, headers: { location: "https://hop2.example.com/step" } },
      { status: 302, headers: { location: "https://internal.evil.com/steal" } },
    ]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://hop1.example.com/start",
        fetchImpl,
        lookupFn: lookup,
        pinDns: false,
      }),
    ).rejects.toThrow(SsrFBlockedError);
  });

  it("blocks public -> private single redirect", async () => {
    const lookup = sequenceLookup([
      [{ address: "93.184.216.34", family: 4 }], // first: public
      [{ address: "192.168.1.1", family: 4 }], // redirect target: private
    ]);
    const fetchImpl = mockFetch([
      { status: 301, headers: { location: "https://router.local.evil.com/" } },
    ]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://legit.example.com/resource",
        fetchImpl,
        lookupFn: lookup,
        pinDns: false,
      }),
    ).rejects.toThrow(SsrFBlockedError);
  });

  it("allows public -> public redirect chain completing successfully", async () => {
    const lookup = staticLookup([{ address: "93.184.216.34", family: 4 }]);
    const fetchImpl = mockFetch([
      { status: 302, headers: { location: "https://cdn.example.com/asset" } },
      { status: 200, body: "content" },
    ]);
    const result = await fetchWithSsrFGuard({
      url: "https://example.com/download",
      fetchImpl,
      lookupFn: lookup,
      pinDns: false,
    });
    expect(result.response.status).toBe(200);
    expect(result.finalUrl).toBe("https://cdn.example.com/asset");
    await result.release();
  });
});

// ---------------------------------------------------------------------------
// SSRF integration tests: IPv6-mapped IPv4 and protocol validation
// ---------------------------------------------------------------------------

describe("SSRF integration: IPv6-mapped IPv4 and protocol validation", () => {
  it("isPrivateIpAddress detects ::ffff:127.0.0.1 as private", () => {
    expect(isPrivateIpAddress("::ffff:127.0.0.1")).toBe(true);
  });

  it("isPrivateIpAddress detects ::ffff:10.0.0.1 as private", () => {
    expect(isPrivateIpAddress("::ffff:10.0.0.1")).toBe(true);
  });

  it("isPrivateIpAddress detects ::ffff:192.168.1.1 as private", () => {
    expect(isPrivateIpAddress("::ffff:192.168.1.1")).toBe(true);
  });

  it("isPrivateIpAddress detects ::ffff:169.254.169.254 as private", () => {
    expect(isPrivateIpAddress("::ffff:169.254.169.254")).toBe(true);
  });

  it("isPrivateIpAddress detects ::1 (IPv6 loopback) as private", () => {
    expect(isPrivateIpAddress("::1")).toBe(true);
  });

  it("isPrivateIpAddress detects fe80:: (link-local IPv6) as private", () => {
    expect(isPrivateIpAddress("fe80::1")).toBe(true);
  });

  it("isPrivateIpAddress detects fc00:: (unique local IPv6) as private", () => {
    expect(isPrivateIpAddress("fc00::1")).toBe(true);
  });

  it("isPrivateIpAddress detects fd00:: (unique local IPv6) as private", () => {
    expect(isPrivateIpAddress("fd12::abcd")).toBe(true);
  });

  it("isPrivateIpAddress allows public IPv4", () => {
    expect(isPrivateIpAddress("93.184.216.34")).toBe(false);
  });

  it("blocks DNS resolving to IPv6-mapped private IPv4", async () => {
    const fetchImpl = mockFetch([{ status: 200 }]);
    const lookup = staticLookup([{ address: "::ffff:127.0.0.1", family: 6 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "https://attacker.example.com/ipv6map",
        fetchImpl,
        lookupFn: lookup,
        pinDns: false,
      }),
    ).rejects.toThrow(SsrFBlockedError);
  });

  it("rejects ftp:// protocol", async () => {
    const fetchImpl = mockFetch([{ status: 200 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "ftp://example.com/file.txt",
        fetchImpl,
        lookupFn: staticLookup([{ address: "93.184.216.34", family: 4 }]),
      }),
    ).rejects.toThrow("Invalid URL: must be http or https");
  });

  it("rejects file:// protocol", async () => {
    const fetchImpl = mockFetch([{ status: 200 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "file:///etc/passwd",
        fetchImpl,
        lookupFn: staticLookup([{ address: "93.184.216.34", family: 4 }]),
      }),
    ).rejects.toThrow("Invalid URL: must be http or https");
  });

  it("rejects javascript: protocol", async () => {
    const fetchImpl = mockFetch([{ status: 200 }]);
    await expect(
      fetchWithSsrFGuard({
        url: "javascript:alert(1)",
        fetchImpl,
        lookupFn: staticLookup([]),
      }),
    ).rejects.toThrow();
  });
});

describe("isPrivateIpAddress - full-form IPv6 bypass prevention", () => {
  it("blocks full-form IPv6-mapped loopback", () => {
    expect(isPrivateIpAddress("0:0:0:0:0:ffff:127.0.0.1")).toBe(true);
  });

  it("blocks full-form IPv6-mapped private 10.x", () => {
    expect(isPrivateIpAddress("0:0:0:0:0:ffff:10.0.0.1")).toBe(true);
  });

  it("blocks full-form IPv6-mapped metadata IP", () => {
    expect(isPrivateIpAddress("0:0:0:0:0:ffff:169.254.169.254")).toBe(true);
  });

  it("blocks padded full-form", () => {
    expect(isPrivateIpAddress("0000:0000:0000:0000:0000:ffff:127.0.0.1")).toBe(true);
  });

  it("blocks uppercase FFFF variant", () => {
    expect(isPrivateIpAddress("0:0:0:0:0:FFFF:127.0.0.1")).toBe(true);
  });

  it("blocks partial compression 0::ffff:127.0.0.1", () => {
    expect(isPrivateIpAddress("0::ffff:127.0.0.1")).toBe(true);
  });

  it("allows full-form IPv6-mapped public IP", () => {
    expect(isPrivateIpAddress("0:0:0:0:0:ffff:8.8.8.8")).toBe(false);
  });

  it("blocks full-form hex-encoded loopback", () => {
    expect(isPrivateIpAddress("0:0:0:0:0:ffff:7f00:1")).toBe(true);
  });
});
