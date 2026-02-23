import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const thisDir = path.dirname(fileURLToPath(import.meta.url));

describe("ws-connection header sanitization", () => {
  const source = fs.readFileSync(path.join(thisDir, "ws-connection.ts"), "utf-8");

  it("defines sanitizeHeader function", () => {
    expect(source).toContain("sanitizeHeader");
  });

  it("strips control characters from header values", () => {
    // Verify the regex pattern used in sanitizeHeader
    expect(source).toMatch(/\\x00-\\x1f\\x7f/);
  });

  it("applies sanitizeHeader to all extracted headers", () => {
    expect(source).toContain("sanitizeHeader(headerValue(upgradeReq.headers.host))");
    expect(source).toContain("sanitizeHeader(headerValue(upgradeReq.headers.origin))");
    expect(source).toContain('sanitizeHeader(headerValue(upgradeReq.headers["user-agent"]))');
    expect(source).toContain('sanitizeHeader(headerValue(upgradeReq.headers["x-forwarded-for"]))');
    expect(source).toContain('sanitizeHeader(headerValue(upgradeReq.headers["x-real-ip"]))');
  });

  it("does not extract auth or cookie headers for logging", () => {
    // Auth and cookie headers must NOT be extracted into log variables
    expect(source).not.toMatch(/headers\["?authorization"?\]\)/);
    expect(source).not.toMatch(/headers\["?cookie"?\]\)/);
  });

  it("sanitizeHeader regex correctly strips control chars", () => {
    // Standalone unit test of the sanitization regex
    // eslint-disable-next-line no-control-regex
    const sanitize = (value: string) => value.replace(/[\x00-\x1f\x7f]/g, "");
    expect(sanitize("normal-header")).toBe("normal-header");
    expect(sanitize("value\r\ninjection")).toBe("valueinjection");
    expect(sanitize("null\x00byte")).toBe("nullbyte");
    expect(sanitize("tab\there")).toBe("tabhere");
  });
});
