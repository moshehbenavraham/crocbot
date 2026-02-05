import fs from "node:fs";
import path from "node:path";

import { resolvecrocbotPackageRoot } from "../infra/crocbot-root.js";

export async function resolvecrocbotDocsPath(params: {
  workspaceDir?: string;
  argv1?: string;
  cwd?: string;
  moduleUrl?: string;
}): Promise<string | null> {
  const workspaceDir = params.workspaceDir?.trim();
  if (workspaceDir) {
    const workspaceDocs = path.join(workspaceDir, "docs");
    if (fs.existsSync(workspaceDocs)) {
      return workspaceDocs;
    }
  }

  const packageRoot = await resolvecrocbotPackageRoot({
    cwd: params.cwd,
    argv1: params.argv1,
    moduleUrl: params.moduleUrl,
  });
  if (!packageRoot) {
    return null;
  }

  const packageDocs = path.join(packageRoot, "docs");
  return fs.existsSync(packageDocs) ? packageDocs : null;
}
