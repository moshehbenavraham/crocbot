import { describe, expect, it } from "vitest";

import { getDefaultRedactPatterns, redactSensitiveText } from "./redact.js";

const defaults = getDefaultRedactPatterns();

describe("redactSensitiveText", () => {
  it("masks env assignments while keeping the key", () => {
    const input = "OPENAI_API_KEY=sk-1234567890abcdef";
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: defaults,
    });
    expect(output).toBe("OPENAI_API_KEY=sk-123…cdef");
  });

  it("masks CLI flags", () => {
    const input = "curl --token abcdef1234567890ghij https://api.test";
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: defaults,
    });
    expect(output).toBe("curl --token abcdef…ghij https://api.test");
  });

  it("masks JSON fields", () => {
    const input = '{"token":"abcdef1234567890ghij"}';
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: defaults,
    });
    expect(output).toBe('{"token":"abcdef…ghij"}');
  });

  it("masks bearer tokens", () => {
    const input = "Authorization: Bearer abcdef1234567890ghij";
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: defaults,
    });
    expect(output).toBe("Authorization: Bearer abcdef…ghij");
  });

  it("masks Telegram-style tokens", () => {
    const input = "123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: defaults,
    });
    expect(output).toBe("123456…cdef");
  });

  it("redacts short tokens fully", () => {
    const input = "TOKEN=shortvalue";
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: defaults,
    });
    expect(output).toBe("TOKEN=***");
  });

  it("redacts private key blocks", () => {
    const input = [
      "-----BEGIN PRIVATE KEY-----",
      "ABCDEF1234567890",
      "ZYXWVUT987654321",
      "-----END PRIVATE KEY-----",
    ].join("\n");
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: defaults,
    });
    expect(output).toBe(
      ["-----BEGIN PRIVATE KEY-----", "…redacted…", "-----END PRIVATE KEY-----"].join("\n"),
    );
  });

  it("honors custom patterns with flags", () => {
    const input = "token=abcdef1234567890ghij";
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: ["/token=([A-Za-z0-9]+)/i"],
    });
    expect(output).toBe("token=abcdef…ghij");
  });

  it("skips redaction when mode is off", () => {
    const input = "OPENAI_API_KEY=sk-1234567890abcdef";
    const output = redactSensitiveText(input, {
      mode: "off",
      patterns: defaults,
    });
    expect(output).toBe(input);
  });

  it("masks international phone numbers with country code", () => {
    const input = "Contact: +1 234-567-8901";
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: defaults,
    });
    expect(output).toBe("Contact: +1 234\u20268901");
  });

  it("masks phone numbers with different formats", () => {
    const inputs = ["+44 20 7946 0958", "+972-54-123-4567", "+1.555.867.5309"];
    for (const input of inputs) {
      const output = redactSensitiveText(input, {
        mode: "tools",
        patterns: defaults,
      });
      expect(output).not.toBe(input);
      expect(output).toContain("\u2026");
    }
  });

  it("masks North American phone numbers without country code", () => {
    const input = "Call me at (555) 867-5309";
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: defaults,
    });
    expect(output).not.toContain("867-5309");
  });

  it("masks session file paths", () => {
    const input = "Session at /home/user/.crocbot/sessions/agent-123/session.json";
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: defaults,
    });
    expect(output).not.toContain("/home/user/.crocbot/sessions/agent-123/session.json");
  });

  it("masks macOS session file paths", () => {
    const input = "Config: /Users/john/.crocbot/agents/main/logs.jsonl";
    const output = redactSensitiveText(input, {
      mode: "tools",
      patterns: defaults,
    });
    expect(output).not.toContain("/Users/john/.crocbot/agents/main/logs.jsonl");
  });
});
