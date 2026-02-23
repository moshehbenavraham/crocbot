/**
 * In-process Promise chain mutex for serializing async operations.
 *
 * Replaces `proper-lockfile` for auth store access -- zero dependencies,
 * no filesystem overhead, and no stale-lock edge cases.
 */

export interface Mutex {
  /** Acquire the lock. Returns a release function that MUST be called when done. */
  acquire(): Promise<() => void>;
}

/**
 * Create a Promise chain mutex that serializes concurrent callers.
 *
 * Each `acquire()` call chains onto the previous one, ensuring only one
 * holder runs at a time. Errors in one holder do not block subsequent callers.
 */
export function createMutex(): Mutex {
  let tail = Promise.resolve();

  function acquire(): Promise<() => void> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const ticket = tail.then(() => release);

    // Chain the next waiter after this gate resolves (or the holder errors).
    // Using .then(()=>gate, ()=>gate) ensures errors don't break the chain.
    tail = tail.then(
      () => gate,
      () => gate,
    );

    return ticket;
  }

  return { acquire };
}
