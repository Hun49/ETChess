/**
 * Standardized API & Protocol Error Codes
 */
export const API_ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED", // 401
  FORBIDDEN: "FORBIDDEN", // 403
  NOT_FOUND: "NOT_FOUND", // 404
  VALIDATION_FAILED: "VALIDATION_FAILED", // 400
  CONFLICT: "CONFLICT", // 409
  RATE_LIMITED: "RATE_LIMITED", // 429
  UPGRADE_REQUIRED: "UPGRADE_REQUIRED", // 426
  INTERNAL: "INTERNAL", // 500
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode | string;
    message: string;
    details?: unknown;
  };
}

/**
 * Standardized WebSocket Close Codes
 */
export const WS_CLOSE_CODES = {
  UNAUTHORIZED: 4001,
  VERSION_UNSUPPORTED: 4002,
  RATE_LIMITED: 4003,
  REPLACED_BY_NEWER_CONNECTION: 4004,
} as const;

export type WsCloseCode = (typeof WS_CLOSE_CODES)[keyof typeof WS_CLOSE_CODES];
