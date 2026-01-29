import { describe, expect, it } from "vitest";

import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it("detects help/version flags", () => {
    expect(hasHelpOrVersion(["node", "crocbot", "--help"])).toBe(true);
    expect(hasHelpOrVersion(["node", "crocbot", "-V"])).toBe(true);
    expect(hasHelpOrVersion(["node", "crocbot", "status"])).toBe(false);
  });

  it("extracts command path ignoring flags and terminator", () => {
    expect(getCommandPath(["node", "crocbot", "status", "--json"], 2)).toEqual(["status"]);
    expect(getCommandPath(["node", "crocbot", "agents", "list"], 2)).toEqual(["agents", "list"]);
    expect(getCommandPath(["node", "crocbot", "status", "--", "ignored"], 2)).toEqual(["status"]);
  });

  it("returns primary command", () => {
    expect(getPrimaryCommand(["node", "crocbot", "agents", "list"])).toBe("agents");
    expect(getPrimaryCommand(["node", "crocbot"])).toBeNull();
  });

  it("parses boolean flags and ignores terminator", () => {
    expect(hasFlag(["node", "crocbot", "status", "--json"], "--json")).toBe(true);
    expect(hasFlag(["node", "crocbot", "--", "--json"], "--json")).toBe(false);
  });

  it("extracts flag values with equals and missing values", () => {
    expect(getFlagValue(["node", "crocbot", "status", "--timeout", "5000"], "--timeout")).toBe(
      "5000",
    );
    expect(getFlagValue(["node", "crocbot", "status", "--timeout=2500"], "--timeout")).toBe("2500");
    expect(getFlagValue(["node", "crocbot", "status", "--timeout"], "--timeout")).toBeNull();
    expect(getFlagValue(["node", "crocbot", "status", "--timeout", "--json"], "--timeout")).toBe(
      null,
    );
    expect(getFlagValue(["node", "crocbot", "--", "--timeout=99"], "--timeout")).toBeUndefined();
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "crocbot", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "crocbot", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "crocbot", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it("parses positive integer flag values", () => {
    expect(getPositiveIntFlagValue(["node", "crocbot", "status"], "--timeout")).toBeUndefined();
    expect(
      getPositiveIntFlagValue(["node", "crocbot", "status", "--timeout"], "--timeout"),
    ).toBeNull();
    expect(
      getPositiveIntFlagValue(["node", "crocbot", "status", "--timeout", "5000"], "--timeout"),
    ).toBe(5000);
    expect(
      getPositiveIntFlagValue(["node", "crocbot", "status", "--timeout", "nope"], "--timeout"),
    ).toBeUndefined();
  });

  it("builds parse argv from raw args", () => {
    const nodeArgv = buildParseArgv({
      programName: "crocbot",
      rawArgs: ["node", "crocbot", "status"],
    });
    expect(nodeArgv).toEqual(["node", "crocbot", "status"]);

    const versionedNodeArgv = buildParseArgv({
      programName: "crocbot",
      rawArgs: ["node-22", "crocbot", "status"],
    });
    expect(versionedNodeArgv).toEqual(["node-22", "crocbot", "status"]);

    const versionedNodeWindowsArgv = buildParseArgv({
      programName: "crocbot",
      rawArgs: ["node-22.2.0.exe", "crocbot", "status"],
    });
    expect(versionedNodeWindowsArgv).toEqual(["node-22.2.0.exe", "crocbot", "status"]);

    const versionedNodePatchlessArgv = buildParseArgv({
      programName: "crocbot",
      rawArgs: ["node-22.2", "crocbot", "status"],
    });
    expect(versionedNodePatchlessArgv).toEqual(["node-22.2", "crocbot", "status"]);

    const versionedNodeWindowsPatchlessArgv = buildParseArgv({
      programName: "crocbot",
      rawArgs: ["node-22.2.exe", "crocbot", "status"],
    });
    expect(versionedNodeWindowsPatchlessArgv).toEqual(["node-22.2.exe", "crocbot", "status"]);

    const versionedNodeWithPathArgv = buildParseArgv({
      programName: "crocbot",
      rawArgs: ["/usr/bin/node-22.2.0", "crocbot", "status"],
    });
    expect(versionedNodeWithPathArgv).toEqual(["/usr/bin/node-22.2.0", "crocbot", "status"]);

    const nodejsArgv = buildParseArgv({
      programName: "crocbot",
      rawArgs: ["nodejs", "crocbot", "status"],
    });
    expect(nodejsArgv).toEqual(["nodejs", "crocbot", "status"]);

    const nonVersionedNodeArgv = buildParseArgv({
      programName: "crocbot",
      rawArgs: ["node-dev", "crocbot", "status"],
    });
    expect(nonVersionedNodeArgv).toEqual(["node", "crocbot", "node-dev", "crocbot", "status"]);

    const directArgv = buildParseArgv({
      programName: "crocbot",
      rawArgs: ["crocbot", "status"],
    });
    expect(directArgv).toEqual(["node", "crocbot", "status"]);

    const bunArgv = buildParseArgv({
      programName: "crocbot",
      rawArgs: ["bun", "src/entry.ts", "status"],
    });
    expect(bunArgv).toEqual(["bun", "src/entry.ts", "status"]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "crocbot",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "crocbot", "status"]);
  });

  it("decides when to migrate state", () => {
    expect(shouldMigrateState(["node", "crocbot", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "crocbot", "health"])).toBe(false);
    expect(shouldMigrateState(["node", "crocbot", "sessions"])).toBe(false);
    expect(shouldMigrateState(["node", "crocbot", "memory", "status"])).toBe(false);
    expect(shouldMigrateState(["node", "crocbot", "agent", "--message", "hi"])).toBe(false);
    expect(shouldMigrateState(["node", "crocbot", "agents", "list"])).toBe(true);
    expect(shouldMigrateState(["node", "crocbot", "message", "send"])).toBe(true);
  });

  it("reuses command path for migrate state decisions", () => {
    expect(shouldMigrateStateFromPath(["status"])).toBe(false);
    expect(shouldMigrateStateFromPath(["agents", "list"])).toBe(true);
  });
});
