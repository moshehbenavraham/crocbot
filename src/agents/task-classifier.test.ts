import { describe, expect, it } from "vitest";
import { classifyTask, TASK_TYPES } from "./task-classifier.js";
import type { TaskClassification } from "./task-classifier.js";

describe("classifyTask", () => {
  describe("utility task types", () => {
    it.each([
      ["compaction", "compaction"],
      ["memory-flush", "memory-flush"],
      ["heartbeat", "heartbeat"],
      ["llm-task", "llm-task"],
    ] as const)('classifies "%s" as utility role with label "%s"', (taskType, expectedLabel) => {
      const result = classifyTask(taskType);
      expect(result).toEqual({
        taskType,
        role: "utility",
        label: expectedLabel,
      });
    });
  });

  describe("reasoning task type", () => {
    it('classifies "reasoning" as reasoning role with label "agent-turn"', () => {
      const result = classifyTask("reasoning");
      expect(result).toEqual({
        taskType: "reasoning",
        role: "reasoning",
        label: "agent-turn",
      });
    });
  });

  describe("unknown task types", () => {
    it("defaults unknown task types to reasoning role", () => {
      const result = classifyTask("unknown-task");
      expect(result.role).toBe("reasoning");
      expect(result.label).toBe("unknown-task");
    });

    it("defaults empty string to reasoning with label 'unknown'", () => {
      const result = classifyTask("");
      expect(result.role).toBe("reasoning");
      expect(result.label).toBe("unknown");
    });
  });

  describe("classification completeness", () => {
    it("all defined task types produce valid classifications", () => {
      for (const taskType of TASK_TYPES) {
        const result = classifyTask(taskType);
        expect(result.taskType).toBe(taskType);
        expect(result.role).toMatch(/^(reasoning|utility)$/);
        expect(result.label).toBeTruthy();
      }
    });

    it("all classifications have unique labels", () => {
      const labels = TASK_TYPES.map((t) => classifyTask(t).label);
      const unique = new Set(labels);
      expect(unique.size).toBe(labels.length);
    });

    it("TASK_TYPES contains exactly 6 entries", () => {
      expect(TASK_TYPES).toHaveLength(6);
    });
  });

  describe("type consistency", () => {
    it("returns the same reference for repeated calls with same task type", () => {
      const a = classifyTask("compaction");
      const b = classifyTask("compaction");
      expect(a).toBe(b);
    });

    it("each classification satisfies TaskClassification shape", () => {
      for (const taskType of TASK_TYPES) {
        const result: TaskClassification = classifyTask(taskType);
        expect(typeof result.taskType).toBe("string");
        expect(typeof result.role).toBe("string");
        expect(typeof result.label).toBe("string");
      }
    });
  });
});
