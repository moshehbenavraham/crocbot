import { describe, expect, it } from "vitest";
import { buildProjectAwareSessionKey, extractProjectFromSessionKey } from "./session-key.js";
import { parseAgentSessionKey } from "../sessions/session-key-utils.js";

/* ------------------------------------------------------------------ */
/* buildProjectAwareSessionKey                                        */
/* ------------------------------------------------------------------ */

describe("buildProjectAwareSessionKey", () => {
  it("inserts project segment after agent prefix", () => {
    const result = buildProjectAwareSessionKey({
      baseSessionKey: "agent:main:telegram:group:123",
      projectId: "myapp",
    });
    expect(result).toBe("agent:main:project:myapp:telegram:group:123");
  });

  it("returns base key unchanged for default project", () => {
    const base = "agent:main:telegram:group:123";
    expect(buildProjectAwareSessionKey({ baseSessionKey: base, projectId: "default" })).toBe(base);
  });

  it("returns base key unchanged for null/undefined project", () => {
    const base = "agent:main:telegram:group:123";
    expect(buildProjectAwareSessionKey({ baseSessionKey: base, projectId: null })).toBe(base);
    expect(buildProjectAwareSessionKey({ baseSessionKey: base, projectId: undefined })).toBe(base);
    expect(buildProjectAwareSessionKey({ baseSessionKey: base, projectId: "" })).toBe(base);
  });

  it("normalizes project ID to lowercase", () => {
    const result = buildProjectAwareSessionKey({
      baseSessionKey: "agent:main:telegram:dm:456",
      projectId: "MyApp",
    });
    expect(result).toBe("agent:main:project:myapp:telegram:dm:456");
  });

  it("returns base key unchanged for non-agent session keys", () => {
    const base = "some:other:key";
    expect(buildProjectAwareSessionKey({ baseSessionKey: base, projectId: "myapp" })).toBe(base);
  });
});

/* ------------------------------------------------------------------ */
/* extractProjectFromSessionKey                                       */
/* ------------------------------------------------------------------ */

describe("extractProjectFromSessionKey", () => {
  it("extracts project ID from session key with project segment", () => {
    expect(extractProjectFromSessionKey("agent:main:project:myapp:telegram:group:123")).toBe(
      "myapp",
    );
  });

  it("returns undefined for key without project segment", () => {
    expect(extractProjectFromSessionKey("agent:main:telegram:group:123")).toBeUndefined();
  });

  it("returns undefined for null/undefined/empty", () => {
    expect(extractProjectFromSessionKey(null)).toBeUndefined();
    expect(extractProjectFromSessionKey(undefined)).toBeUndefined();
    expect(extractProjectFromSessionKey("")).toBeUndefined();
  });

  it("handles project-only rest segment", () => {
    expect(extractProjectFromSessionKey("agent:main:project:myapp")).toBe("myapp");
  });
});

/* ------------------------------------------------------------------ */
/* parseAgentSessionKey with project                                  */
/* ------------------------------------------------------------------ */

describe("parseAgentSessionKey with project", () => {
  it("extracts projectId from project-aware session key", () => {
    const parsed = parseAgentSessionKey("agent:main:project:myapp:telegram:group:123");
    expect(parsed).not.toBeNull();
    expect(parsed?.agentId).toBe("main");
    expect(parsed?.projectId).toBe("myapp");
  });

  it("returns no projectId for standard session key", () => {
    const parsed = parseAgentSessionKey("agent:main:telegram:group:123");
    expect(parsed).not.toBeNull();
    expect(parsed?.agentId).toBe("main");
    expect(parsed?.projectId).toBeUndefined();
  });

  it("returns null for invalid session keys", () => {
    expect(parseAgentSessionKey("")).toBeNull();
    expect(parseAgentSessionKey("invalid")).toBeNull();
    expect(parseAgentSessionKey("agent:main")).toBeNull();
  });

  it("handles project as final segment", () => {
    const parsed = parseAgentSessionKey("agent:main:project:myapp");
    expect(parsed).not.toBeNull();
    expect(parsed?.projectId).toBe("myapp");
  });
});

/* ------------------------------------------------------------------ */
/* Round-trip: build -> extract                                       */
/* ------------------------------------------------------------------ */

describe("session key round-trip", () => {
  it("extract recovers project from build", () => {
    const built = buildProjectAwareSessionKey({
      baseSessionKey: "agent:main:telegram:dm:999",
      projectId: "webapp",
    });
    expect(extractProjectFromSessionKey(built)).toBe("webapp");
  });

  it("extract returns undefined for default-project round-trip", () => {
    const built = buildProjectAwareSessionKey({
      baseSessionKey: "agent:main:telegram:dm:999",
      projectId: "default",
    });
    expect(extractProjectFromSessionKey(built)).toBeUndefined();
  });
});
