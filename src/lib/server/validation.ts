/**
 * Strict request-body validation. Extra fields are forbidden; field paths
 * mirror pydantic-style "body.email" details so the form can map them.
 */
import { ValidationError } from "./errors";
import type { ValidationErrorDetail } from "./errors";
import { MIN_PASSWORD_LENGTH } from "./config";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validationError(details: ValidationErrorDetail[]): ValidationError {
  return new ValidationError(details);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface LoginInput {
  email: string;
  password: string;
}

export function validateLogin(body: unknown): LoginInput {
  if (!isRecord(body)) {
    throw validationError([{ field: "body", message: "Input should be a valid object" }]);
  }
  const details: ValidationErrorDetail[] = [];
  for (const key of Object.keys(body)) {
    if (key !== "email" && key !== "password") {
      details.push({ field: `body.${key}`, message: "Extra inputs are not permitted" });
    }
  }
  let email = "";
  let password = "";
  const emailValue = body.email;
  if (typeof emailValue !== "string") {
    details.push({ field: "body.email", message: "Input should be a valid string" });
  } else if (emailValue.length < 1) {
    details.push({ field: "body.email", message: "String should have at least 1 character" });
  } else if (emailValue.length > 320) {
    details.push({ field: "body.email", message: "String should have at most 320 characters" });
  } else {
    email = emailValue;
  }
  const passwordValue = body.password;
  if (typeof passwordValue !== "string") {
    details.push({ field: "body.password", message: "Input should be a valid string" });
  } else if (passwordValue.length < 1) {
    details.push({ field: "body.password", message: "String should have at least 1 character" });
  } else if (passwordValue.length > 1024) {
    details.push({ field: "body.password", message: "String should have at most 1024 characters" });
  } else {
    password = passwordValue;
  }
  if (details.length > 0) {
    throw validationError(details);
  }
  return { email, password };
}

export interface DraftInput {
  connectedness: number | null;
  support: number | null;
  workload: number | null;
}

export interface RegisterEmployeeInput {
  role: "EMPLOYEE";
  email: string;
  password: string;
  organization_id: string;
  team_id: string;
}

export type RegisterInput = RegisterEmployeeInput;

const REGISTER_FIELDS = new Set(["email", "password", "role", "organization_id", "team_id"]);

export function validateRegister(body: unknown): RegisterInput {
  if (!isRecord(body)) {
    throw validationError([{ field: "body", message: "Input should be a valid object" }]);
  }
  const details: ValidationErrorDetail[] = [];
  for (const key of Object.keys(body)) {
    if (!REGISTER_FIELDS.has(key)) {
      details.push({ field: `body.${key}`, message: "Extra inputs are not permitted" });
    }
  }

  let email = "";
  const emailValue = body.email;
  if (typeof emailValue !== "string") {
    details.push({ field: "body.email", message: "Input should be a valid string" });
  } else if (!EMAIL_PATTERN.test(emailValue.trim()) || emailValue.length > 320) {
    details.push({ field: "body.email", message: "Input should be a valid email address" });
  } else {
    email = emailValue.trim().toLowerCase();
  }

  let password = "";
  const passwordValue = body.password;
  if (typeof passwordValue !== "string") {
    details.push({ field: "body.password", message: "Input should be a valid string" });
  } else if (passwordValue.length < MIN_PASSWORD_LENGTH) {
    details.push({
      field: "body.password",
      message: `String should have at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  } else if (passwordValue.length > 1024) {
    details.push({ field: "body.password", message: "String should have at most 1024 characters" });
  } else {
    password = passwordValue;
  }

  let role: "EMPLOYEE" | null = null;
  const roleValue = body.role;
  if (roleValue !== "EMPLOYEE") {
    // HR accounts are provisioned by the server; sign-up is employee-only.
    details.push({ field: "body.role", message: "Sign-up is for employee accounts only" });
  } else {
    role = roleValue;
  }

  if (role === "EMPLOYEE") {
    let organizationId = "";
    const organizationValue = body.organization_id;
    if (typeof organizationValue !== "string" || !UUID_PATTERN.test(organizationValue)) {
      details.push({ field: "body.organization_id", message: "Choose your organization" });
    } else {
      organizationId = organizationValue.toLowerCase();
    }
    let teamId = "";
    const teamValue = body.team_id;
    if (typeof teamValue !== "string" || !UUID_PATTERN.test(teamValue)) {
      details.push({ field: "body.team_id", message: "Choose your team" });
    } else {
      teamId = teamValue.toLowerCase();
    }
    if (details.length > 0) {
      throw validationError(details);
    }
    return { role, email, password, organization_id: organizationId, team_id: teamId };
  }

  // Role was missing or not EMPLOYEE: the details array already carries that error.
  throw validationError(details);
}

function validateAnswerField(value: unknown, field: string): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw validationError([{ field, message: "Input should be a valid integer" }]);
  }
  if (value < 0) {
    throw validationError([{ field, message: "Input should be greater than or equal to 0" }]);
  }
  if (value > 10) {
    throw validationError([{ field, message: "Input should be less than or equal to 10" }]);
  }
  return value;
}

export function validateDraft(body: unknown): DraftInput {
  if (!isRecord(body)) {
    throw validationError([{ field: "body", message: "Input should be a valid object" }]);
  }
  const details: ValidationErrorDetail[] = [];
  for (const key of Object.keys(body)) {
    if (key !== "connectedness" && key !== "support" && key !== "workload") {
      details.push({ field: `body.${key}`, message: "Extra inputs are not permitted" });
    }
  }
  if (details.length > 0) {
    throw validationError(details);
  }
  return {
    connectedness: validateAnswerField(body.connectedness, "body.connectedness"),
    support: validateAnswerField(body.support, "body.support"),
    workload: validateAnswerField(body.workload, "body.workload"),
  };
}

export function requireUuid(value: string, field: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw validationError([{ field, message: "Input should be a valid UUID" }]);
  }
  return value.toLowerCase();
}
