import path from "node:path";
import { describe, expect, it } from "vitest";

import { constrainOutputPath } from "./path-output.js";

describe("constrainOutputPath", () => {
  it("allows a valid relative path within the directory", () => {
    const result = constrainOutputPath({ filePath: "file.txt", allowedDir: "/data/output" });
    expect(result).toBe(path.resolve("/data/output", "file.txt"));
  });

  it("allows nested paths within the directory", () => {
    const result = constrainOutputPath({
      filePath: "sub/dir/file.txt",
      allowedDir: "/data/output",
    });
    expect(result).toBe(path.resolve("/data/output", "sub/dir/file.txt"));
  });

  it("blocks ../ traversal", () => {
    expect(() =>
      constrainOutputPath({ filePath: "../../../etc/passwd", allowedDir: "/data/output" }),
    ).toThrow("escapes allowed directory");
  });

  it("blocks absolute path escape", () => {
    expect(() =>
      constrainOutputPath({ filePath: "/etc/passwd", allowedDir: "/data/output" }),
    ).toThrow("escapes allowed directory");
  });

  it("allows the directory root itself", () => {
    const result = constrainOutputPath({ filePath: ".", allowedDir: "/data/output" });
    expect(result).toBe(path.resolve("/data/output"));
  });

  it("blocks path that resolves outside via ../ in the middle", () => {
    expect(() =>
      constrainOutputPath({ filePath: "sub/../../outside.txt", allowedDir: "/data/output" }),
    ).toThrow("escapes allowed directory");
  });
});
