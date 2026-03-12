export class AppError extends Error {
  code: string;
  statusCode?: number;
  details?: unknown;
  cause?: unknown;

  constructor(params: {
    message: string;
    code: string;
    statusCode?: number;
    details?: unknown;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "AppError";
    this.code = params.code ?? "UNKNOWN_ERROR";
    this.statusCode = params.statusCode;
    this.details = params.details;
    this.cause = params.cause;
  }
}

export function toAppError(error: unknown) {
  if (error instanceof AppError) return error;

  if (error instanceof Error) {
    return new AppError({
      message: error.message,
      code: "UNEXPECTED_ERROR",
      cause: error,
    });
  }

  return new AppError({
    message: "Unexpected error",
    code: "UNEXPECTED_ERROR",
    details: error,
  });
}
