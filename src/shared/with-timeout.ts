/**
 * Reusable timeout wrapper using AbortSignal.timeout().
 * Rejects with a TimeoutError if the promise does not resolve within `ms` milliseconds.
 * Optionally accepts an external AbortSignal for caller-initiated cancellation.
 */

export class TimeoutError extends Error {
  override readonly name = "TimeoutError";
  constructor(message?: string) {
    super(message ?? "Operation timed out");
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error("Aborted", { cause: signal.reason });
  }

  const timeoutSignal = AbortSignal.timeout(ms);
  const combined = signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal;

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      combined.removeEventListener("abort", onAbort);
      if (timeoutSignal.aborted) {
        reject(new TimeoutError(`Operation timed out after ${ms}ms`));
      } else {
        const reason = combined.reason;
        reject(reason instanceof Error ? reason : new Error("Aborted", { cause: reason }));
      }
    };

    if (combined.aborted) {
      onAbort();
      return;
    }

    combined.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        combined.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        combined.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}
