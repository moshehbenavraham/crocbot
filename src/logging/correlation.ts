import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Correlation context for request tracing.
 * Stores a unique correlation ID and optional Telegram-specific metadata.
 */
export type CorrelationContext = {
  correlationId: string;
  chatId?: string | number;
  userId?: string | number;
  messageId?: string | number;
};

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Generate a short correlation ID (8 characters).
 * Uses crypto.randomUUID() and extracts first 8 hex chars for readability.
 */
export function generateCorrelationId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

/**
 * Run a function within a correlation context.
 * Creates a new correlation ID if not provided.
 */
export function runWithCorrelation<T>(fn: () => T, context?: Partial<CorrelationContext>): T {
  const correlationId = context?.correlationId ?? generateCorrelationId();
  const fullContext: CorrelationContext = {
    correlationId,
    chatId: context?.chatId,
    userId: context?.userId,
    messageId: context?.messageId,
  };
  return correlationStorage.run(fullContext, fn);
}

/**
 * Run an async function within a correlation context.
 * Creates a new correlation ID if not provided.
 */
export function runWithCorrelationAsync<T>(
  fn: () => Promise<T>,
  context?: Partial<CorrelationContext>,
): Promise<T> {
  const correlationId = context?.correlationId ?? generateCorrelationId();
  const fullContext: CorrelationContext = {
    correlationId,
    chatId: context?.chatId,
    userId: context?.userId,
    messageId: context?.messageId,
  };
  return correlationStorage.run(fullContext, fn);
}

/**
 * Get the current correlation context.
 * Returns undefined if not within a correlation context.
 */
export function getCorrelationContext(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

/**
 * Get the current correlation ID.
 * Returns undefined if not within a correlation context.
 */
export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}

/**
 * Update the current correlation context with additional metadata.
 * Only works if already within a correlation context.
 * Returns true if the context was updated, false otherwise.
 */
export function updateCorrelationContext(
  updates: Partial<Omit<CorrelationContext, "correlationId">>,
): boolean {
  const current = correlationStorage.getStore();
  if (!current) return false;

  if (updates.chatId !== undefined) current.chatId = updates.chatId;
  if (updates.userId !== undefined) current.userId = updates.userId;
  if (updates.messageId !== undefined) current.messageId = updates.messageId;

  return true;
}
