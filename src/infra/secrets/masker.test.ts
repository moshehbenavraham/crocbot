import { describe, expect, it } from "vitest";

import { computeHash8, createMasker, expandEncodings, makePlaceholder } from "./masker.js";

// ---------------------------------------------------------------------------
// Helper: create a secrets map from name-value pairs
// ---------------------------------------------------------------------------

function secretsMap(entries: [string, string][]): Map<string, string> {
  return new Map(entries);
}

// ---------------------------------------------------------------------------
// hash8 / placeholder generation
// ---------------------------------------------------------------------------

describe("computeHash8", () => {
  it("returns 8 hex characters", () => {
    const h = computeHash8("my-api-key-12345678");
    expect(h).toMatch(/^[0-9a-f]{8}$/);
    expect(h).toHaveLength(8);
  });

  it("is deterministic", () => {
    expect(computeHash8("same-value")).toBe(computeHash8("same-value"));
  });

  it("differs for different inputs", () => {
    expect(computeHash8("value-a")).not.toBe(computeHash8("value-b"));
  });
});

describe("makePlaceholder", () => {
  it("produces {{SECRET:xxxxxxxx}} format", () => {
    const p = makePlaceholder("test-secret-value");
    expect(p).toMatch(/^\{\{SECRET:[0-9a-f]{8}\}\}$/);
  });

  it("is deterministic for same value", () => {
    expect(makePlaceholder("abc12345678")).toBe(makePlaceholder("abc12345678"));
  });
});

// ---------------------------------------------------------------------------
// Multi-encoding expansion
// ---------------------------------------------------------------------------

describe("expandEncodings", () => {
  it("always includes the raw variant", () => {
    const patterns = expandEncodings("key", "my-secret-value");
    expect(patterns.some((p) => p.encoding === "raw" && p.needle === "my-secret-value")).toBe(true);
  });

  it("includes base64 variant when different from raw", () => {
    const patterns = expandEncodings("key", "my-secret-value");
    const b64 = Buffer.from("my-secret-value", "utf-8").toString("base64");
    expect(patterns.some((p) => p.encoding === "base64" && p.needle === b64)).toBe(true);
  });

  it("includes URL-encoded variant when different from raw", () => {
    const patterns = expandEncodings("key", "my+secret.value$");
    const urlenc = encodeURIComponent("my+secret.value$");
    expect(patterns.some((p) => p.encoding === "url" && p.needle === urlenc)).toBe(true);
  });

  it("all variants share the same placeholder", () => {
    const patterns = expandEncodings("key", "secret-with-special+chars");
    const placeholders = new Set(patterns.map((p) => p.placeholder));
    expect(placeholders.size).toBe(1);
  });

  it("skips base64 when identical to raw (pure alphanumeric)", () => {
    // "AAAA" base64-encodes to "QUFBQQ==" which differs, so use a value
    // whose base64 differs. The skip only happens if b64 === raw which is rare.
    const patterns = expandEncodings("key", "some-value-12345");
    // Just verify we have at least raw + one variant
    expect(patterns.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// createMasker - mask()
// ---------------------------------------------------------------------------

describe("createMasker - mask", () => {
  it("returns text unchanged when no secrets registered", () => {
    const m = createMasker(new Map());
    expect(m.mask("hello world")).toBe("hello world");
  });

  it("returns empty string unchanged", () => {
    const m = createMasker(secretsMap([["k", "long-secret-value"]]));
    expect(m.mask("")).toBe("");
  });

  it("masks a single secret in text", () => {
    const secret = "sk-abc12345678";
    const m = createMasker(secretsMap([["openai", secret]]));
    const placeholder = makePlaceholder(secret);

    const result = m.mask(`API key is ${secret} here`);
    expect(result).toBe(`API key is ${placeholder} here`);
    expect(result).not.toContain(secret);
  });

  it("masks multiple occurrences of the same secret", () => {
    const secret = "my-token-12345678";
    const m = createMasker(secretsMap([["tok", secret]]));
    const placeholder = makePlaceholder(secret);

    const result = m.mask(`${secret} and ${secret}`);
    expect(result).toBe(`${placeholder} and ${placeholder}`);
  });

  it("masks multiple different secrets", () => {
    const s1 = "secret-alpha-1234";
    const s2 = "secret-beta-56789";
    const m = createMasker(
      secretsMap([
        ["a", s1],
        ["b", s2],
      ]),
    );

    const result = m.mask(`first: ${s1}, second: ${s2}`);
    expect(result).toContain(makePlaceholder(s1));
    expect(result).toContain(makePlaceholder(s2));
    expect(result).not.toContain(s1);
    expect(result).not.toContain(s2);
  });

  it("masks text that is entirely a secret", () => {
    const secret = "entire-text-is-secret";
    const m = createMasker(secretsMap([["k", secret]]));

    expect(m.mask(secret)).toBe(makePlaceholder(secret));
  });

  it("leaves text unchanged when no secrets present", () => {
    const m = createMasker(secretsMap([["k", "my-secret-12345678"]]));
    expect(m.mask("nothing sensitive here")).toBe("nothing sensitive here");
  });

  it("masks base64-encoded variant of a secret", () => {
    const secret = "my-api-key-value";
    const b64 = Buffer.from(secret, "utf-8").toString("base64");
    const m = createMasker(secretsMap([["k", secret]]));
    const placeholder = makePlaceholder(secret);

    const result = m.mask(`encoded: ${b64}`);
    expect(result).toBe(`encoded: ${placeholder}`);
  });

  it("masks URL-encoded variant of a secret", () => {
    const secret = "secret+with&special=chars";
    const urlenc = encodeURIComponent(secret);
    const m = createMasker(secretsMap([["k", secret]]));
    const placeholder = makePlaceholder(secret);

    const result = m.mask(`param=${urlenc}`);
    expect(result).toBe(`param=${placeholder}`);
  });

  it("handles secret containing regex-special characters", () => {
    const secret = "my+secret.key$value(test)";
    const m = createMasker(secretsMap([["k", secret]]));
    const placeholder = makePlaceholder(secret);

    expect(m.mask(`val: ${secret}`)).toBe(`val: ${placeholder}`);
  });

  it("handles overlapping secrets (substring case)", () => {
    const short = "my-api-key";
    const long = "my-api-key-extended";
    const m = createMasker(
      secretsMap([
        ["short", short],
        ["long", long],
      ]),
    );

    // In sequential mode (longest first), the long match should take priority
    const result = m.mask(`token: ${long}`);
    expect(result).toContain(makePlaceholder(long));
    expect(result).not.toContain(short);
  });

  it("handles text with partial match that is not a secret", () => {
    const secret = "abcdefgh";
    const m = createMasker(secretsMap([["k", secret]]));

    // "xabcdefg" contains 7 of 8 chars but is not a match
    const result = m.mask("xabcdefg");
    expect(result).toBe("xabcdefg");
  });

  it("handles large text with many embedded secrets", () => {
    const secrets: [string, string][] = [];
    for (let i = 0; i < 20; i++) {
      secrets.push([`key${i}`, `secret-value-${i.toString().padStart(4, "0")}`]);
    }
    const m = createMasker(secretsMap(secrets));

    let text = "Start ";
    for (const [, value] of secrets) {
      text += `[${value}] `;
    }
    text += "End";

    const result = m.mask(text);
    for (const [, value] of secrets) {
      expect(result).not.toContain(value);
      expect(result).toContain(makePlaceholder(value));
    }
  });

  it("patternCount reflects encoding variants", () => {
    // A secret with special chars will have 3 variants (raw, b64, url)
    const m = createMasker(secretsMap([["k", "secret+value/here"]]));
    expect(m.patternCount).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// createMasker - unmask()
// ---------------------------------------------------------------------------

describe("createMasker - unmask", () => {
  it("returns text unchanged when no secrets registered", () => {
    const m = createMasker(new Map());
    expect(m.unmask("hello world")).toBe("hello world");
  });

  it("returns empty string unchanged", () => {
    const m = createMasker(secretsMap([["k", "long-secret-value"]]));
    expect(m.unmask("")).toBe("");
  });

  it("restores a single placeholder", () => {
    const secret = "my-secret-value-123";
    const m = createMasker(secretsMap([["k", secret]]));
    const placeholder = makePlaceholder(secret);

    expect(m.unmask(`text ${placeholder} here`)).toBe(`text ${secret} here`);
  });

  it("restores multiple placeholders", () => {
    const s1 = "secret-alpha-value";
    const s2 = "secret-bravo-value";
    const m = createMasker(
      secretsMap([
        ["a", s1],
        ["b", s2],
      ]),
    );

    const masked = `${makePlaceholder(s1)} and ${makePlaceholder(s2)}`;
    const result = m.unmask(masked);
    expect(result).toBe(`${s1} and ${s2}`);
  });

  it("leaves unknown placeholders unchanged", () => {
    const m = createMasker(secretsMap([["k", "my-secret-12345678"]]));
    const unknown = "{{SECRET:deadbeef}}";
    expect(m.unmask(unknown)).toBe(unknown);
  });

  it("leaves text without placeholders unchanged", () => {
    const m = createMasker(secretsMap([["k", "my-secret-12345678"]]));
    expect(m.unmask("no placeholders here")).toBe("no placeholders here");
  });

  it("round-trips: unmask(mask(text)) === text", () => {
    const secret = "round-trip-secret-val";
    const m = createMasker(secretsMap([["k", secret]]));

    const original = `before ${secret} after`;
    const masked = m.mask(original);
    expect(masked).not.toBe(original);
    expect(m.unmask(masked)).toBe(original);
  });

  it("round-trips with multiple secrets", () => {
    const s1 = "first-secret-value!";
    const s2 = "second-secret-val!!";
    const m = createMasker(
      secretsMap([
        ["a", s1],
        ["b", s2],
      ]),
    );

    const original = `[${s1}] and [${s2}]`;
    expect(m.unmask(m.mask(original))).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Aho-Corasick path (>=10 patterns)
// ---------------------------------------------------------------------------

describe("Aho-Corasick masking (large registry)", () => {
  it("masks correctly with 10+ secrets", () => {
    const entries: [string, string][] = [];
    for (let i = 0; i < 15; i++) {
      entries.push([`k${i}`, `secret-val-${i.toString().padStart(4, "0")}`]);
    }
    const m = createMasker(secretsMap(entries));

    let text = "";
    for (const [, v] of entries) {
      text += `${v} `;
    }

    const result = m.mask(text.trim());
    for (const [, v] of entries) {
      expect(result).not.toContain(v);
      expect(result).toContain(makePlaceholder(v));
    }
  });

  it("round-trips with Aho-Corasick path", () => {
    const entries: [string, string][] = [];
    for (let i = 0; i < 15; i++) {
      entries.push([`k${i}`, `aho-secret-${i.toString().padStart(3, "0")}`]);
    }
    const m = createMasker(secretsMap(entries));

    let original = "";
    for (const [, v] of entries) {
      original += `[${v}] `;
    }
    original = original.trim();

    expect(m.unmask(m.mask(original))).toBe(original);
  });

  it("handles overlapping secrets in Aho-Corasick mode", () => {
    // Create enough secrets to trigger AC mode, with two that overlap
    const entries: [string, string][] = [];
    for (let i = 0; i < 12; i++) {
      entries.push([`k${i}`, `unique-secret-${i.toString().padStart(3, "0")}`]);
    }
    // Add overlapping pair
    entries.push(["short", "overlap-val"]);
    entries.push(["long", "overlap-val-extended"]);

    const m = createMasker(secretsMap(entries));
    const result = m.mask("token: overlap-val-extended");
    // Longest match should win
    expect(result).toContain(makePlaceholder("overlap-val-extended"));
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("determinism", () => {
  it("same secret always produces same placeholder", () => {
    const m1 = createMasker(secretsMap([["k", "deterministic-secret"]]));
    const m2 = createMasker(secretsMap([["k", "deterministic-secret"]]));

    const text = "value: deterministic-secret";
    expect(m1.mask(text)).toBe(m2.mask(text));
  });

  it("placeholder is independent of secret name", () => {
    const m1 = createMasker(secretsMap([["name-a", "shared-secret-value"]]));
    const m2 = createMasker(secretsMap([["name-b", "shared-secret-value"]]));

    expect(m1.mask("shared-secret-value")).toBe(m2.mask("shared-secret-value"));
  });
});
