import { describe, expect, it, vi } from "vitest";

import {
  type LookupFn,
  SsrFBlockedError,
  isPrivateIpAddress,
  normalizeHostnameSet,
  resolvePinnedHostnameWithPolicy,
} from "./ssrf.js";

function mockLookup(addresses: Array<{ address: string; family: number }>): LookupFn {
  return vi.fn(async () => addresses);
}

describe("normalizeHostnameSet", () => {
  it("returns empty set for undefined", () => {
    expect(normalizeHostnameSet(undefined).size).toBe(0);
  });

  it("returns empty set for empty array", () => {
    expect(normalizeHostnameSet([]).size).toBe(0);
  });

  it("normalizes and deduplicates", () => {
    const result = normalizeHostnameSet(["Example.COM", "example.com.", "OTHER.net"]);
    expect(result.size).toBe(2);
    expect(result.has("example.com")).toBe(true);
    expect(result.has("other.net")).toBe(true);
  });

  it("filters empty strings", () => {
    const result = normalizeHostnameSet(["valid.com", "", "  "]);
    expect(result.size).toBe(1);
    expect(result.has("valid.com")).toBe(true);
  });
});

describe("resolvePinnedHostnameWithPolicy", () => {
  describe("default policy (no policy provided)", () => {
    it("resolves a public hostname", async () => {
      const lookup = mockLookup([{ address: "93.184.216.34", family: 4 }]);
      const result = await resolvePinnedHostnameWithPolicy("example.com", { lookupFn: lookup });
      expect(result.hostname).toBe("example.com");
      expect(result.addresses).toEqual(["93.184.216.34"]);
      expect(typeof result.lookup).toBe("function");
    });

    it("blocks localhost hostname", async () => {
      const lookup = mockLookup([]);
      await expect(
        resolvePinnedHostnameWithPolicy("localhost", { lookupFn: lookup }),
      ).rejects.toThrow(SsrFBlockedError);
    });

    it("blocks metadata.google.internal hostname", async () => {
      const lookup = mockLookup([]);
      await expect(
        resolvePinnedHostnameWithPolicy("metadata.google.internal", { lookupFn: lookup }),
      ).rejects.toThrow(SsrFBlockedError);
    });

    it("blocks .local suffix hostname", async () => {
      const lookup = mockLookup([]);
      await expect(
        resolvePinnedHostnameWithPolicy("myhost.local", { lookupFn: lookup }),
      ).rejects.toThrow(SsrFBlockedError);
    });

    it("blocks .internal suffix hostname", async () => {
      const lookup = mockLookup([]);
      await expect(
        resolvePinnedHostnameWithPolicy("api.internal", { lookupFn: lookup }),
      ).rejects.toThrow(SsrFBlockedError);
    });

    it("blocks direct private IP address 10.0.0.1", async () => {
      const lookup = mockLookup([]);
      await expect(
        resolvePinnedHostnameWithPolicy("10.0.0.1", { lookupFn: lookup }),
      ).rejects.toThrow(SsrFBlockedError);
    });

    it("blocks direct private IP address 127.0.0.1", async () => {
      const lookup = mockLookup([]);
      await expect(
        resolvePinnedHostnameWithPolicy("127.0.0.1", { lookupFn: lookup }),
      ).rejects.toThrow(SsrFBlockedError);
    });

    it("blocks direct private IP address 192.168.1.1", async () => {
      const lookup = mockLookup([]);
      await expect(
        resolvePinnedHostnameWithPolicy("192.168.1.1", { lookupFn: lookup }),
      ).rejects.toThrow(SsrFBlockedError);
    });

    it("blocks cloud metadata IP 169.254.169.254", async () => {
      const lookup = mockLookup([]);
      await expect(
        resolvePinnedHostnameWithPolicy("169.254.169.254", { lookupFn: lookup }),
      ).rejects.toThrow(SsrFBlockedError);
    });

    it("blocks DNS-resolved private IP", async () => {
      const lookup = mockLookup([{ address: "10.0.0.8", family: 4 }]);
      await expect(
        resolvePinnedHostnameWithPolicy("evil.com", { lookupFn: lookup }),
      ).rejects.toThrow(SsrFBlockedError);
    });

    it("blocks DNS-resolved 169.254.169.254 (cloud metadata)", async () => {
      const lookup = mockLookup([{ address: "169.254.169.254", family: 4 }]);
      await expect(
        resolvePinnedHostnameWithPolicy("evil.com", { lookupFn: lookup }),
      ).rejects.toThrow(SsrFBlockedError);
    });

    it("throws on empty hostname", async () => {
      await expect(resolvePinnedHostnameWithPolicy("")).rejects.toThrow("Invalid hostname");
    });

    it("throws when DNS returns zero results", async () => {
      const lookup = mockLookup([]);
      await expect(
        resolvePinnedHostnameWithPolicy("example.com", { lookupFn: lookup }),
      ).rejects.toThrow("Unable to resolve hostname");
    });
  });

  describe("allowPrivateNetwork policy", () => {
    it("allows localhost when allowPrivateNetwork is true", async () => {
      const lookup = mockLookup([{ address: "127.0.0.1", family: 4 }]);
      const result = await resolvePinnedHostnameWithPolicy("localhost", {
        lookupFn: lookup,
        policy: { allowPrivateNetwork: true },
      });
      expect(result.hostname).toBe("localhost");
      expect(result.addresses).toEqual(["127.0.0.1"]);
    });

    it("allows private IP when allowPrivateNetwork is true", async () => {
      const lookup = mockLookup([{ address: "192.168.1.100", family: 4 }]);
      const result = await resolvePinnedHostnameWithPolicy("192.168.1.100", {
        lookupFn: lookup,
        policy: { allowPrivateNetwork: true },
      });
      expect(result.addresses).toEqual(["192.168.1.100"]);
    });

    it("allows DNS-resolved private IP when allowPrivateNetwork is true", async () => {
      const lookup = mockLookup([{ address: "10.0.0.5", family: 4 }]);
      const result = await resolvePinnedHostnameWithPolicy("internal.corp", {
        lookupFn: lookup,
        policy: { allowPrivateNetwork: true },
      });
      expect(result.addresses).toEqual(["10.0.0.5"]);
    });
  });

  describe("allowedHostnames policy", () => {
    it("allows a normally-blocked hostname when in allowedHostnames", async () => {
      const lookup = mockLookup([{ address: "127.0.0.1", family: 4 }]);
      const result = await resolvePinnedHostnameWithPolicy("localhost", {
        lookupFn: lookup,
        policy: { allowedHostnames: ["localhost"] },
      });
      expect(result.hostname).toBe("localhost");
      expect(result.addresses).toEqual(["127.0.0.1"]);
    });

    it("hostname matching is case-insensitive", async () => {
      const lookup = mockLookup([{ address: "127.0.0.1", family: 4 }]);
      const result = await resolvePinnedHostnameWithPolicy("LocalHost", {
        lookupFn: lookup,
        policy: { allowedHostnames: ["LOCALHOST"] },
      });
      expect(result.hostname).toBe("localhost");
    });

    it("does not allow a hostname not in the allowlist", async () => {
      const lookup = mockLookup([]);
      await expect(
        resolvePinnedHostnameWithPolicy("metadata.google.internal", {
          lookupFn: lookup,
          policy: { allowedHostnames: ["localhost"] },
        }),
      ).rejects.toThrow(SsrFBlockedError);
    });
  });

  describe("LookupFn export", () => {
    it("LookupFn type is importable and assignable", () => {
      const fn: LookupFn = vi.fn(async () => [{ address: "1.2.3.4", family: 4 }]);
      expect(typeof fn).toBe("function");
    });
  });
});

describe("isPrivateIpAddress - IPv6-mapped IPv4", () => {
  describe("compressed form (::ffff:)", () => {
    it("blocks ::ffff:127.0.0.1", () => {
      expect(isPrivateIpAddress("::ffff:127.0.0.1")).toBe(true);
    });

    it("blocks ::ffff:10.0.0.1", () => {
      expect(isPrivateIpAddress("::ffff:10.0.0.1")).toBe(true);
    });

    it("blocks ::ffff:169.254.169.254 (metadata)", () => {
      expect(isPrivateIpAddress("::ffff:169.254.169.254")).toBe(true);
    });

    it("allows ::ffff:8.8.8.8 (public)", () => {
      expect(isPrivateIpAddress("::ffff:8.8.8.8")).toBe(false);
    });
  });

  describe("full-form (0:0:0:0:0:ffff:)", () => {
    it("blocks 0:0:0:0:0:ffff:127.0.0.1", () => {
      expect(isPrivateIpAddress("0:0:0:0:0:ffff:127.0.0.1")).toBe(true);
    });

    it("blocks 0000:0000:0000:0000:0000:ffff:127.0.0.1 (max padding)", () => {
      expect(isPrivateIpAddress("0000:0000:0000:0000:0000:ffff:127.0.0.1")).toBe(true);
    });

    it("blocks 0:0:0:0:0:ffff:10.0.0.1", () => {
      expect(isPrivateIpAddress("0:0:0:0:0:ffff:10.0.0.1")).toBe(true);
    });

    it("blocks 0:0:0:0:0:ffff:192.168.1.1", () => {
      expect(isPrivateIpAddress("0:0:0:0:0:ffff:192.168.1.1")).toBe(true);
    });

    it("blocks 0:0:0:0:0:ffff:169.254.169.254 (metadata)", () => {
      expect(isPrivateIpAddress("0:0:0:0:0:ffff:169.254.169.254")).toBe(true);
    });

    it("allows 0:0:0:0:0:ffff:8.8.8.8 (public)", () => {
      expect(isPrivateIpAddress("0:0:0:0:0:ffff:8.8.8.8")).toBe(false);
    });

    it("blocks full-form hex-encoded IPv4: 0:0:0:0:0:ffff:7f00:1", () => {
      expect(isPrivateIpAddress("0:0:0:0:0:ffff:7f00:1")).toBe(true);
    });
  });

  describe("mixed-case hex", () => {
    it("blocks 0:0:0:0:0:FFFF:127.0.0.1 (uppercase)", () => {
      expect(isPrivateIpAddress("0:0:0:0:0:FFFF:127.0.0.1")).toBe(true);
    });

    it("blocks ::FFFF:127.0.0.1 (uppercase compressed)", () => {
      expect(isPrivateIpAddress("::FFFF:127.0.0.1")).toBe(true);
    });

    it("blocks 0:0:0:0:0:Ffff:10.0.0.1 (mixed case)", () => {
      expect(isPrivateIpAddress("0:0:0:0:0:Ffff:10.0.0.1")).toBe(true);
    });
  });

  describe("partial compression", () => {
    it("blocks 0::ffff:127.0.0.1", () => {
      expect(isPrivateIpAddress("0::ffff:127.0.0.1")).toBe(true);
    });

    it("blocks 0:0::ffff:127.0.0.1", () => {
      expect(isPrivateIpAddress("0:0::ffff:127.0.0.1")).toBe(true);
    });

    it("blocks 0:0:0::ffff:127.0.0.1", () => {
      expect(isPrivateIpAddress("0:0:0::ffff:127.0.0.1")).toBe(true);
    });

    it("blocks 0:0:0:0::ffff:127.0.0.1", () => {
      expect(isPrivateIpAddress("0:0:0:0::ffff:127.0.0.1")).toBe(true);
    });
  });

  describe("bracket notation", () => {
    it("blocks [::ffff:127.0.0.1]", () => {
      expect(isPrivateIpAddress("[::ffff:127.0.0.1]")).toBe(true);
    });

    it("blocks [0:0:0:0:0:ffff:127.0.0.1]", () => {
      expect(isPrivateIpAddress("[0:0:0:0:0:ffff:127.0.0.1]")).toBe(true);
    });
  });

  describe("variable zero-padding", () => {
    it("blocks 00:000:0:0000:0:ffff:127.0.0.1", () => {
      expect(isPrivateIpAddress("00:000:0:0000:0:ffff:127.0.0.1")).toBe(true);
    });
  });
});
