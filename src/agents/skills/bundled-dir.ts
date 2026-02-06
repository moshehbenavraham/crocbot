import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveBundledSkillsDir(): string | undefined {
  const override = process.env.CROCBOT_BUNDLED_SKILLS_DIR?.trim();
  if (override) return override;

  // bun --compile: ship a sibling `skills/` next to the executable.
  try {
    const execDir = path.dirname(process.execPath);
    const sibling = path.join(execDir, "skills");
    if (fs.existsSync(sibling)) return sibling;
  } catch {
    // ignore
  }

  // npm/dev: walk up from this module until we find a directory containing `skills/`.
  // Works both in source layout (src/agents/skills/) and flat dist output (dist/).
  try {
    let dir = path.dirname(fileURLToPath(import.meta.url));
    const root = path.parse(dir).root;
    while (dir !== root) {
      const candidate = path.join(dir, "skills");
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
      dir = path.dirname(dir);
    }
  } catch {
    // ignore
  }

  return undefined;
}
