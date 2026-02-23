import { describe, expect, it } from "vitest";

import { getOwnedPids, isOwnedPid, registerOwnedPid, unregisterOwnedPid } from "./helpers.js";

describe("PID ownership tracking", () => {
  it("registers and recognizes owned PIDs", () => {
    const pid = 99990;
    registerOwnedPid(pid);
    expect(isOwnedPid(pid)).toBe(true);
    unregisterOwnedPid(pid);
  });

  it("unregisters PIDs", () => {
    const pid = 99991;
    registerOwnedPid(pid);
    unregisterOwnedPid(pid);
    expect(isOwnedPid(pid)).toBe(false);
  });

  it("does not recognize unregistered PIDs", () => {
    expect(isOwnedPid(12345678)).toBe(false);
  });

  it("exposes owned PIDs as a readonly set", () => {
    const pid = 99992;
    registerOwnedPid(pid);
    const pids = getOwnedPids();
    expect(pids.has(pid)).toBe(true);
    unregisterOwnedPid(pid);
  });
});
