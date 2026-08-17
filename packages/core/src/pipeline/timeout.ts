import { TimeoutError } from "../errors/index.js";

/**
 * Creates an AbortSignal that aborts after timeoutMs or forwards an external signal
 */
export function createTimeoutSignal(
  timeoutMs?: number,
  externalSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | null = null;

  if (timeoutMs && timeoutMs > 0) {
    timer = setTimeout(() => {
      controller.abort(new TimeoutError(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  }

  const onExternalAbort = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  };

  return { signal: controller.signal, cleanup };
}

/**
 * Wraps an async operation with a strict timeout
 */
export async function withTimeout<T>(
  promiseFn: (signal: AbortSignal) => Promise<T>,
  timeoutMs?: number,
  externalSignal?: AbortSignal,
  provider = "unknown",
  model = "unknown"
): Promise<T> {
  const { signal, cleanup } = createTimeoutSignal(timeoutMs, externalSignal);
  try {
    return await promiseFn(signal);
  } catch (err) {
    if (signal.aborted) {
      throw new TimeoutError(`Request timed out after ${timeoutMs}ms`, { provider, model, rawError: err });
    }
    throw err;
  } finally {
    cleanup();
  }
}
