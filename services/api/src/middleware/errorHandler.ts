import type { ApiErrorCode } from "@etchess/types";
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import type { Env } from "../types";
import type { HonoVariables } from "./session";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: ContentfulStatusCode;
  readonly details?: unknown;

  constructor(
    code: ApiErrorCode,
    message: string,
    status: ContentfulStatusCode,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const createApiError = {
  unauthenticated: (message = "Authentication required") =>
    new ApiError("UNAUTHENTICATED", message, 401),
  forbidden: (message = "Forbidden") => new ApiError("FORBIDDEN", message, 403),
  notFound: (message = "Resource not found") => new ApiError("NOT_FOUND", message, 404),
  validationFailed: (message = "Validation failed", details?: unknown) =>
    new ApiError("VALIDATION_FAILED", message, 400, details),
  conflict: (message = "Conflict") => new ApiError("CONFLICT", message, 409),
  rateLimited: (message = "Too many requests. Please slow down.") =>
    new ApiError("RATE_LIMITED", message, 429),
  upgradeRequired: (message = "WebSocket upgrade required") =>
    new ApiError("UPGRADE_REQUIRED", message, 426),
  internal: (message = "Internal server error") => new ApiError("INTERNAL", message, 500),
};

function statusToErrorCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "VALIDATION_FAILED";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 426:
      return "UPGRADE_REQUIRED";
    case 429:
      return "RATE_LIMITED";
    default:
      return "INTERNAL";
  }
}

export const globalErrorHandler: ErrorHandler<{
  Bindings: Env;
  Variables: HonoVariables;
}> = (err, c) => {
  const requestId = c.get("requestId") || c.req.header("x-request-id") || "unknown";

  if (err instanceof ApiError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      err.status,
    );
  }

  if (err instanceof ZodError) {
    const message =
      err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ") || "Validation failed";
    return c.json(
      {
        error: {
          code: "VALIDATION_FAILED" as const,
          message,
          details: err.flatten(),
        },
      },
      400,
    );
  }

  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode;
    return c.json(
      {
        error: {
          code: statusToErrorCode(status),
          message: err.message,
        },
      },
      status,
    );
  }

  // Unhandled / Internal Server Error (500)
  console.error(
    JSON.stringify({
      level: "error",
      type: "unhandled_exception",
      timestamp: new Date().toISOString(),
      requestId,
      error: err.message,
      stack: err.stack,
    }),
  );

  return c.json(
    {
      error: {
        code: "INTERNAL" as const,
        message: "Internal server error",
      },
    },
    500,
  );
};

export const globalNotFoundHandler: NotFoundHandler<{
  Bindings: Env;
  Variables: HonoVariables;
}> = (c) => {
  return c.json(
    {
      error: {
        code: "NOT_FOUND" as const,
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
    },
    404,
  );
};
