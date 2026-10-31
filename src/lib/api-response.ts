/**
 * Standardized API & Server Action Response Contract for Brightloop
 * All team members must adhere to this contract across all domain modules.
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Creates a standard success response
 */
export function apiSuccess<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Creates a standard error response
 */
export function apiError(
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

/**
 * Common System Error Codes
 */
export const ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  DUPLICATE_BILLING_CYCLE: "DUPLICATE_BILLING_CYCLE",
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;
