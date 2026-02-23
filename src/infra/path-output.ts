import path from "node:path";

export function constrainOutputPath(params: { filePath: string; allowedDir: string }): string {
  const normalizedDir = path.resolve(params.allowedDir);
  const resolved = path.resolve(normalizedDir, params.filePath);
  if (resolved !== normalizedDir && !resolved.startsWith(normalizedDir + path.sep)) {
    throw new Error(`Output path escapes allowed directory: ${params.filePath}`);
  }
  return resolved;
}
