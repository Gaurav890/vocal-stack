/**
 * Base error class for all vocal-stack errors
 */
export class VocalStackError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'VocalStackError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Stable error raised by the v2 voice pipeline.
 */
export class VoicePipelineError extends VocalStackError {
  public readonly cause: unknown;

  constructor(
    message: string,
    code: string,
    options: {
      readonly cause?: unknown;
      readonly context?: Record<string, unknown>;
    } = {}
  ) {
    super(message, code, options.context);
    this.name = 'VoicePipelineError';
    this.cause = options.cause;
  }
}

/**
 * Error thrown during text sanitization
 */
export class SanitizerError extends VocalStackError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SANITIZER_ERROR', context);
    this.name = 'SanitizerError';
  }
}

/**
 * Error thrown during flow control operations
 */
export class FlowControlError extends VocalStackError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'FLOW_CONTROL_ERROR', context);
    this.name = 'FlowControlError';
  }
}

/**
 * Error thrown during monitoring operations
 */
export class MonitorError extends VocalStackError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'MONITOR_ERROR', context);
    this.name = 'MonitorError';
  }
}
