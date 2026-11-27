/**
 * Domain errors. Every error maps onto one envelope:
 * {"error": {"code", "message"}} (+ details for 422 validation errors).
 */

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export class ValidationError extends Error {
  readonly details: ValidationErrorDetail[];
  constructor(details: ValidationErrorDetail[]) {
    super("request validation failed");
    this.name = "ValidationError";
    this.details = details;
  }
}

export class NotAuthenticatedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotAuthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

export class EmailAlreadyRegisteredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class OrganizationAlreadyExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizationAlreadyExistsError";
  }
}

export class ConcurrentDraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConcurrentDraftError";
  }
}

export class CheckInAlreadySubmittedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckInAlreadySubmittedError";
  }
}

export class IncompleteCheckInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncompleteCheckInError";
  }
}

export interface ErrorShape {
  status: number;
  code: string;
  message: string;
}

/** Maps a domain error onto its HTTP shape; null when the error is unexpected. */
export function shapeFor(error: unknown): ErrorShape | null {
  if (error instanceof ValidationError) {
    return { status: 422, code: "validation_error", message: error.message };
  }
  if (error instanceof NotAuthenticatedError) {
    return { status: 401, code: "not_authenticated", message: error.message };
  }
  if (error instanceof ForbiddenError) {
    return { status: 403, code: "forbidden", message: error.message };
  }
  if (error instanceof NotFoundError) {
    return { status: 404, code: "not_found", message: error.message };
  }
  if (error instanceof InvalidCredentialsError) {
    return { status: 401, code: "invalid_credentials", message: error.message };
  }
  if (error instanceof EmailAlreadyRegisteredError) {
    return { status: 409, code: "email_already_registered", message: error.message };
  }
  if (error instanceof OrganizationAlreadyExistsError) {
    return { status: 409, code: "organization_already_exists", message: error.message };
  }
  if (error instanceof ConcurrentDraftError) {
    return { status: 409, code: "concurrent_draft", message: error.message };
  }
  if (error instanceof CheckInAlreadySubmittedError) {
    return { status: 409, code: "check_in_already_submitted", message: error.message };
  }
  if (error instanceof IncompleteCheckInError) {
    return { status: 422, code: "incomplete_check_in", message: error.message };
  }
  return null;
}
