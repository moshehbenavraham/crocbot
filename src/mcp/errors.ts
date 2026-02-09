/** Error thrown when an MCP server connection fails or is unavailable. */
export class McpConnectionError extends Error {
  override readonly name = "McpConnectionError";
  readonly serverName: string;

  constructor(serverName: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.serverName = serverName;
  }
}

/** Error thrown when an MCP tool call fails or times out. */
export class McpToolError extends Error {
  override readonly name = "McpToolError";
  readonly serverName: string;
  readonly toolName: string;
  readonly isTimeout: boolean;

  constructor(
    serverName: string,
    toolName: string,
    message: string,
    options?: ErrorOptions & { isTimeout?: boolean },
  ) {
    super(message, options);
    this.serverName = serverName;
    this.toolName = toolName;
    this.isTimeout = options?.isTimeout ?? false;
  }
}
