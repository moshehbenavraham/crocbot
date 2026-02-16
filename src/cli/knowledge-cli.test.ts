import { Command } from "commander";
import { describe, expect, it } from "vitest";

import { registerKnowledgeCli } from "./knowledge-cli.js";

// -- Helpers --

function createProgram(): Command {
  const program = new Command();
  program.exitOverride(); // Prevent process.exit in tests
  registerKnowledgeCli(program);
  return program;
}

function findCommand(program: Command, ...path: string[]): Command | undefined {
  let current: Command = program;
  for (const name of path) {
    const sub = current.commands.find((c) => c.name() === name);
    if (!sub) {
      return undefined;
    }
    current = sub;
  }
  return current;
}

describe("registerKnowledgeCli", () => {
  it("registers the knowledge parent command", () => {
    const program = createProgram();
    const knowledge = findCommand(program, "knowledge");
    expect(knowledge).toBeDefined();
    expect(knowledge?.description()).toBe("Knowledge base import and management");
  });

  it("registers import subcommand", () => {
    const program = createProgram();
    const importCmd = findCommand(program, "knowledge", "import");
    expect(importCmd).toBeDefined();
    expect(importCmd?.description()).toBe("Import a document into the knowledge base");
  });

  it("registers list subcommand", () => {
    const program = createProgram();
    const listCmd = findCommand(program, "knowledge", "list");
    expect(listCmd).toBeDefined();
    expect(listCmd?.description()).toBe("List imported knowledge sources");
  });

  it("registers remove subcommand", () => {
    const program = createProgram();
    const removeCmd = findCommand(program, "knowledge", "remove");
    expect(removeCmd).toBeDefined();
    expect(removeCmd?.description()).toBe("Remove an imported knowledge source and its chunks");
  });

  describe("import command options", () => {
    it("has --project option", () => {
      const program = createProgram();
      const importCmd = findCommand(program, "knowledge", "import");
      const option = importCmd?.options.find((o) => o.long === "--project");
      expect(option).toBeDefined();
    });

    it("has --category option with default", () => {
      const program = createProgram();
      const importCmd = findCommand(program, "knowledge", "import");
      const option = importCmd?.options.find((o) => o.long === "--category");
      expect(option).toBeDefined();
      expect(option?.defaultValue).toBe("docs");
    });

    it("has --dry-run option", () => {
      const program = createProgram();
      const importCmd = findCommand(program, "knowledge", "import");
      const option = importCmd?.options.find((o) => o.long === "--dry-run");
      expect(option).toBeDefined();
    });

    it("has --force option", () => {
      const program = createProgram();
      const importCmd = findCommand(program, "knowledge", "import");
      const option = importCmd?.options.find((o) => o.long === "--force");
      expect(option).toBeDefined();
    });

    it("has --batch option", () => {
      const program = createProgram();
      const importCmd = findCommand(program, "knowledge", "import");
      const option = importCmd?.options.find((o) => o.long === "--batch");
      expect(option).toBeDefined();
    });

    it("accepts optional source argument", () => {
      const program = createProgram();
      const importCmd = findCommand(program, "knowledge", "import");
      const args = importCmd?.registeredArguments ?? [];
      expect(args).toHaveLength(1);
      expect(args[0]?.required).toBe(false);
    });
  });

  describe("list command options", () => {
    it("has --project option", () => {
      const program = createProgram();
      const listCmd = findCommand(program, "knowledge", "list");
      const option = listCmd?.options.find((o) => o.long === "--project");
      expect(option).toBeDefined();
    });

    it("has --json option", () => {
      const program = createProgram();
      const listCmd = findCommand(program, "knowledge", "list");
      const option = listCmd?.options.find((o) => o.long === "--json");
      expect(option).toBeDefined();
    });
  });

  describe("remove command options", () => {
    it("has --project option", () => {
      const program = createProgram();
      const removeCmd = findCommand(program, "knowledge", "remove");
      const option = removeCmd?.options.find((o) => o.long === "--project");
      expect(option).toBeDefined();
    });

    it("requires source argument", () => {
      const program = createProgram();
      const removeCmd = findCommand(program, "knowledge", "remove");
      const args = removeCmd?.registeredArguments ?? [];
      expect(args).toHaveLength(1);
      expect(args[0]?.required).toBe(true);
    });
  });
});
