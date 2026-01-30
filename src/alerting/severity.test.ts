import { describe, expect, it } from "vitest";

import {
  classifySeverity,
  compareSeverity,
  meetsMinSeverity,
  SEVERITY_LEVELS,
} from "./severity.js";

describe("severity", () => {
  describe("SEVERITY_LEVELS", () => {
    it("has correct numeric ordering (lower = more severe)", () => {
      expect(SEVERITY_LEVELS.critical).toBeLessThan(SEVERITY_LEVELS.warning);
      expect(SEVERITY_LEVELS.warning).toBeLessThan(SEVERITY_LEVELS.info);
    });
  });

  describe("classifySeverity", () => {
    describe("critical classification", () => {
      it("classifies fatal errors as critical", () => {
        expect(classifySeverity(new Error("Fatal error occurred"))).toBe("critical");
        expect(classifySeverity("fatal: system failure")).toBe("critical");
      });

      it("classifies crash errors as critical", () => {
        expect(classifySeverity(new Error("Application crash detected"))).toBe("critical");
      });

      it("classifies unhandled errors as critical", () => {
        expect(classifySeverity("Unhandled exception in handler")).toBe("critical");
        expect(classifySeverity("uncaught error")).toBe("critical");
      });

      it("classifies auth failures as critical", () => {
        expect(classifySeverity("Authentication failed for user")).toBe("critical");
        expect(classifySeverity("Auth failed: invalid credentials")).toBe("critical");
        expect(classifySeverity("Token invalid")).toBe("critical");
        expect(classifySeverity("Token expired")).toBe("critical");
      });

      it("classifies database errors as critical", () => {
        expect(classifySeverity("Database connection lost")).toBe("critical");
        expect(classifySeverity("Database error: deadlock detected")).toBe("critical");
      });

      it("classifies connection refused as critical", () => {
        expect(classifySeverity("ECONNREFUSED")).toBe("critical");
        expect(classifySeverity("Connection refused to server")).toBe("critical");
      });

      it("classifies memory errors as critical", () => {
        expect(classifySeverity("OOM killer triggered")).toBe("critical");
        expect(classifySeverity("Out of memory")).toBe("critical");
      });
    });

    describe("warning classification", () => {
      it("classifies timeout errors as warning", () => {
        expect(classifySeverity("Request timeout")).toBe("warning");
        expect(classifySeverity("Operation timed out")).toBe("warning");
      });

      it("classifies retry errors as warning", () => {
        expect(classifySeverity("Retrying operation")).toBe("warning");
        expect(classifySeverity("Retry attempt 3")).toBe("warning");
      });

      it("classifies rate limit errors as warning", () => {
        expect(classifySeverity("Rate limit exceeded")).toBe("warning");
        expect(classifySeverity("rate-limit hit")).toBe("warning");
        expect(classifySeverity("ratelimit triggered")).toBe("warning");
      });

      it("classifies network errors as warning", () => {
        expect(classifySeverity("Network error occurred")).toBe("warning");
        expect(classifySeverity("Connection reset by peer")).toBe("warning");
      });

      it("classifies degraded state as warning", () => {
        expect(classifySeverity("Service degraded")).toBe("warning");
        expect(classifySeverity("System running slow")).toBe("warning");
      });

      it("classifies failure phrases as warning", () => {
        expect(classifySeverity("Failed to send message")).toBe("warning");
        expect(classifySeverity("Could not connect")).toBe("warning");
        expect(classifySeverity("Unable to process request")).toBe("warning");
      });
    });

    describe("info classification", () => {
      it("classifies generic errors as info", () => {
        expect(classifySeverity("Something went wrong")).toBe("info");
        expect(classifySeverity("Invalid input")).toBe("info");
        expect(classifySeverity(new Error("User not found"))).toBe("info");
      });

      it("classifies empty errors as info", () => {
        expect(classifySeverity("")).toBe("info");
        expect(classifySeverity(new Error(""))).toBe("info");
      });
    });

    describe("error type handling", () => {
      it("handles Error objects", () => {
        expect(classifySeverity(new Error("Fatal error"))).toBe("critical");
      });

      it("handles strings", () => {
        expect(classifySeverity("timeout occurred")).toBe("warning");
      });

      it("handles objects with message property", () => {
        expect(classifySeverity({ message: "Connection refused" })).toBe("critical");
      });

      it("handles null/undefined", () => {
        expect(classifySeverity(null)).toBe("info");
        expect(classifySeverity(undefined)).toBe("info");
      });

      it("handles numbers", () => {
        expect(classifySeverity(404)).toBe("info");
      });
    });

    describe("case insensitivity", () => {
      it("matches keywords case-insensitively", () => {
        expect(classifySeverity("FATAL ERROR")).toBe("critical");
        expect(classifySeverity("Fatal Error")).toBe("critical");
        expect(classifySeverity("TIMEOUT")).toBe("warning");
        expect(classifySeverity("Timeout")).toBe("warning");
      });
    });
  });

  describe("compareSeverity", () => {
    it("returns negative when first is more severe", () => {
      expect(compareSeverity("critical", "warning")).toBeLessThan(0);
      expect(compareSeverity("critical", "info")).toBeLessThan(0);
      expect(compareSeverity("warning", "info")).toBeLessThan(0);
    });

    it("returns positive when second is more severe", () => {
      expect(compareSeverity("warning", "critical")).toBeGreaterThan(0);
      expect(compareSeverity("info", "critical")).toBeGreaterThan(0);
      expect(compareSeverity("info", "warning")).toBeGreaterThan(0);
    });

    it("returns zero for equal severities", () => {
      expect(compareSeverity("critical", "critical")).toBe(0);
      expect(compareSeverity("warning", "warning")).toBe(0);
      expect(compareSeverity("info", "info")).toBe(0);
    });
  });

  describe("meetsMinSeverity", () => {
    it("returns true when severity meets threshold", () => {
      expect(meetsMinSeverity("critical", "critical")).toBe(true);
      expect(meetsMinSeverity("critical", "warning")).toBe(true);
      expect(meetsMinSeverity("critical", "info")).toBe(true);
      expect(meetsMinSeverity("warning", "warning")).toBe(true);
      expect(meetsMinSeverity("warning", "info")).toBe(true);
      expect(meetsMinSeverity("info", "info")).toBe(true);
    });

    it("returns false when severity does not meet threshold", () => {
      expect(meetsMinSeverity("warning", "critical")).toBe(false);
      expect(meetsMinSeverity("info", "critical")).toBe(false);
      expect(meetsMinSeverity("info", "warning")).toBe(false);
    });
  });
});
