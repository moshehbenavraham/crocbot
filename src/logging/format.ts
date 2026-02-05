/**
 * Log format configuration for structured logging.
 * Supports JSON (production) and pretty (development) modes.
 */

export type LogFormat = "json" | "pretty";

const DEFAULT_FORMAT: LogFormat = "pretty";
const ENV_VAR_NAME = "CROCBOT_LOG_FORMAT";

let cachedFormat: LogFormat | null = null;

/**
 * Resolve the log format from environment variable.
 * Returns "json" if CROCBOT_LOG_FORMAT=json, otherwise "pretty".
 */
export function resolveLogFormat(): LogFormat {
  if (cachedFormat !== null) {
    return cachedFormat;
  }

  const envValue = process.env[ENV_VAR_NAME]?.toLowerCase().trim();
  if (envValue === "json") {
    cachedFormat = "json";
  } else {
    cachedFormat = DEFAULT_FORMAT;
  }
  return cachedFormat;
}

/**
 * Check if JSON format is enabled for file logging.
 */
export function isJsonFormatEnabled(): boolean {
  return resolveLogFormat() === "json";
}

/**
 * Reset the cached format (for testing).
 */
export function resetLogFormat(): void {
  cachedFormat = null;
}

/**
 * Build a structured log entry for JSON output.
 */
export function buildJsonLogEntry(params: {
  level: string;
  message: string;
  subsystem?: string;
  correlationId?: string;
  chatId?: string | number;
  userId?: string | number;
  messageId?: string | number;
  meta?: Record<string, unknown>;
  timestamp?: Date;
}): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    time: (params.timestamp ?? new Date()).toISOString(),
    level: params.level,
  };

  if (params.subsystem) {
    entry.subsystem = params.subsystem;
  }

  if (params.correlationId) {
    entry.correlation_id = params.correlationId;
  }

  if (params.chatId !== undefined) {
    entry.chat_id = params.chatId;
  }

  if (params.userId !== undefined) {
    entry.user_id = params.userId;
  }

  if (params.messageId !== undefined) {
    entry.message_id = params.messageId;
  }

  entry.message = params.message;

  // Spread additional metadata at the end
  if (params.meta && Object.keys(params.meta).length > 0) {
    Object.assign(entry, params.meta);
  }

  return entry;
}
