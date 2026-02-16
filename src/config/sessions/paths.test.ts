import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  resolveProjectSessionsDir,
  resolveSessionTranscriptPath,
  resolveSessionTranscriptsDirForAgent,
} from "./paths.js";

const FAKE_HOME = "/fakehome";
const fakeHomedir = () => FAKE_HOME;

describe("resolveProjectSessionsDir", () => {
  it("returns agent-level sessions dir for undefined projectId", () => {
    const result = resolveProjectSessionsDir("main", undefined, {}, fakeHomedir);
    expect(result).toBe(path.join(FAKE_HOME, ".crocbot", "agents", "main", "sessions"));
  });

  it("returns agent-level sessions dir for null projectId", () => {
    const result = resolveProjectSessionsDir("main", null, {}, fakeHomedir);
    expect(result).toBe(path.join(FAKE_HOME, ".crocbot", "agents", "main", "sessions"));
  });

  it("returns agent-level sessions dir for 'default' projectId", () => {
    const result = resolveProjectSessionsDir("main", "default", {}, fakeHomedir);
    expect(result).toBe(path.join(FAKE_HOME, ".crocbot", "agents", "main", "sessions"));
  });

  it("returns project-scoped sessions dir for named project", () => {
    const result = resolveProjectSessionsDir("main", "my-project", {}, fakeHomedir);
    expect(result).toBe(
      path.join(FAKE_HOME, ".crocbot", "agents", "main", "projects", "my-project", "sessions"),
    );
  });

  it("normalizes project ID", () => {
    const result = resolveProjectSessionsDir("main", "My Project", {}, fakeHomedir);
    expect(result).toBe(
      path.join(FAKE_HOME, ".crocbot", "agents", "main", "projects", "my-project", "sessions"),
    );
  });

  it("uses CROCBOT_STATE_DIR env var when set", () => {
    const env = { CROCBOT_STATE_DIR: "/custom/state" };
    const result = resolveProjectSessionsDir("main", "test-proj", env, fakeHomedir);
    expect(result).toBe(
      path.join("/custom/state", "agents", "main", "projects", "test-proj", "sessions"),
    );
  });
});

describe("resolveSessionTranscriptsDirForAgent with projectId", () => {
  it("returns agent-level sessions dir when projectId is undefined", () => {
    const result = resolveSessionTranscriptsDirForAgent("main", {}, fakeHomedir);
    expect(result).toBe(path.join(FAKE_HOME, ".crocbot", "agents", "main", "sessions"));
  });

  it("returns project-scoped sessions dir for named project", () => {
    const result = resolveSessionTranscriptsDirForAgent("main", {}, fakeHomedir, "my-project");
    expect(result).toBe(
      path.join(FAKE_HOME, ".crocbot", "agents", "main", "projects", "my-project", "sessions"),
    );
  });
});

describe("resolveSessionTranscriptPath with projectId", () => {
  it("returns agent-level transcript path when projectId is undefined", () => {
    const result = resolveSessionTranscriptPath("sess-001", "main", undefined, undefined);
    const expected = path.join("agents", "main", "sessions", "sess-001.jsonl");
    expect(result).toContain(expected);
  });

  it("returns project-scoped transcript path for named project", () => {
    const result = resolveSessionTranscriptPath("sess-001", "main", undefined, "my-project");
    const expected = path.join(
      "agents",
      "main",
      "projects",
      "my-project",
      "sessions",
      "sess-001.jsonl",
    );
    expect(result).toContain(expected);
  });

  it("handles topicId with project-scoped path", () => {
    const result = resolveSessionTranscriptPath("sess-001", "main", "topic-42", "my-project");
    const expected = path.join(
      "agents",
      "main",
      "projects",
      "my-project",
      "sessions",
      "sess-001-topic-topic-42.jsonl",
    );
    expect(result).toContain(expected);
  });

  it("handles numeric topicId with project-scoped path", () => {
    const result = resolveSessionTranscriptPath("sess-001", "main", 42, "my-project");
    const expected = path.join(
      "agents",
      "main",
      "projects",
      "my-project",
      "sessions",
      "sess-001-topic-42.jsonl",
    );
    expect(result).toContain(expected);
  });
});
