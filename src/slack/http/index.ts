// Read-only mode: HTTP webhook receiver is not supported.
// Slack connection uses Socket Mode only.

export function normalizeSlackWebhookPath(path?: string): string {
  return path ?? "/slack/events";
}

export function registerSlackHttpHandler(_opts: {
  path: string;
  handler: unknown;
  log?: ((...args: unknown[]) => void) | null;
  accountId?: string;
}): () => void {
  return () => {};
}
