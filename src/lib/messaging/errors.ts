/**
 * Provider error with a plain-English explanation and a retry decision.
 * Thrown by providers; the queue uses `retryable` to decide between backoff and permanent failure.
 */
export class ProviderError extends Error {
  constructor(
    public readonly info: {
      code: string;
      subcode?: string;
      httpStatus?: number;
      title: string;
      detail?: string;
      friendly: string;
      retryable: boolean;
      traceId?: string;
    },
  ) {
    super(`[${info.code}] ${info.title}${info.detail ? `: ${info.detail}` : ""}`);
    this.name = "ProviderError";
  }

  get code() {
    return this.info.code;
  }
  get retryable() {
    return this.info.retryable;
  }
  get friendly() {
    return this.info.friendly;
  }
}

export function isProviderError(e: unknown): e is ProviderError {
  return e instanceof ProviderError;
}

/** Best-effort friendly message for any thrown value. Never includes credentials. */
export function friendlyError(e: unknown): string {
  if (isProviderError(e)) return e.friendly;
  if (e instanceof Error && e.name === "ConfigError") return e.message;
  return "Something went wrong. Please try again.";
}
