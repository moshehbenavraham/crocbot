import { describe, expect, it } from "vitest";
import {
  buildProjectAwareSessionKey,
  extractProjectFromSessionKey,
  stripProjectFromSessionKey,
} from "./session-key.js";
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

/* ------------------------------------------------------------------ */
/* stripProjectFromSessionKey                                         */
/* ------------------------------------------------------------------ */

describe("stripProjectFromSessionKey", () => {
  it("strips project segment and restores base key", () => {
    expect(stripProjectFromSessionKey("agent:main:project:myapp:telegram:group:123")).toBe(
      "agent:main:telegram:group:123",
    );
  });

  it("returns key unchanged when no project segment", () => {
    const key = "agent:main:telegram:group:123";
    expect(stripProjectFromSessionKey(key)).toBe(key);
  });

  it("restores main key when project is the only rest segment", () => {
    expect(stripProjectFromSessionKey("agent:main:project:myapp")).toBe("agent:main:main");
  });

  it("returns empty string for empty input", () => {
    expect(stripProjectFromSessionKey("")).toBe("");
    expect(stripProjectFromSessionKey(null)).toBe("");
    expect(stripProjectFromSessionKey(undefined)).toBe("");
  });

  it("returns non-agent key unchanged", () => {
    const key = "some:other:key";
    expect(stripProjectFromSessionKey(key)).toBe(key);
  });

  it("handles DM session keys with project", () => {
    expect(stripProjectFromSessionKey("agent:main:project:webapp:telegram:dm:456")).toBe(
      "agent:main:telegram:dm:456",
    );
  });
});

/* ------------------------------------------------------------------ */
/* Full round-trip: build -> extract -> strip                         */
/* ------------------------------------------------------------------ */

describe("session key full round-trip (build -> extract -> strip)", () => {
  it("build -> extract recovers project, strip restores base", () => {
    const base = "agent:main:telegram:group:42";
    const built = buildProjectAwareSessionKey({ baseSessionKey: base, projectId: "webapp" });
    expect(extractProjectFromSessionKey(built)).toBe("webapp");
    expect(stripProjectFromSessionKey(built)).toBe(base);
  });

  it("default project produces identity round-trip", () => {
    const base = "agent:main:telegram:dm:999";
    const built = buildProjectAwareSessionKey({ baseSessionKey: base, projectId: "default" });
    expect(built).toBe(base);
    expect(extractProjectFromSessionKey(built)).toBeUndefined();
    expect(stripProjectFromSessionKey(built)).toBe(base);
  });

  it("null project produces identity round-trip", () => {
    const base = "agent:main:main";
    const built = buildProjectAwareSessionKey({ baseSessionKey: base, projectId: null });
    expect(built).toBe(base);
    expect(stripProjectFromSessionKey(built)).toBe(base);
  });

  it("strip is idempotent on already-stripped keys", () => {
    const base = "agent:main:telegram:group:42";
    const stripped = stripProjectFromSessionKey(base);
    expect(stripProjectFromSessionKey(stripped)).toBe(base);
  });

  it("parseAgentSessionKey extracts projectId from built key", () => {
    const built = buildProjectAwareSessionKey({
      baseSessionKey: "agent:main:telegram:dm:100",
      projectId: "analytics",
    });
    const parsed = parseAgentSessionKey(built);
    expect(parsed).not.toBeNull();
    expect(parsed?.projectId).toBe("analytics");
    expect(parsed?.agentId).toBe("main");
  });
});
