export type ApiErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "VALIDATION_FAILED"
  | "INVALID_REQUEST"
  | "CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "CSRF_FAILED"
  | "PRECONDITION_FAILED"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "LEGACY_CONTRACT_UNSUPPORTED";

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown, requestId: string): Response {
  const apiError = error instanceof ApiError
    ? error
    : new ApiError("INTERNAL_ERROR", 500, "An unexpected error occurred");
  return Response.json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.fields ? { fields: apiError.fields } : {}),
      requestId,
    },
    message: apiError.message,
  }, { status: apiError.status, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store, private", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
}

export function methodNotAllowed(requestId: string, allowed: readonly string[]): Response {
  return Response.json({
    success: false,
    error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed", requestId },
    message: "Method not allowed",
  }, { status: 405, headers: { Allow: allowed.join(", "), "X-Request-Id": requestId, "Cache-Control": "no-store, private", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
}
