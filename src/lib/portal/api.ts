/**
 * The API client. One error type, one envelope; a 401 anywhere clears the
 * session and returns the user to the sign-in form. All calls are same-origin
 * relative paths served by the Next.js API routes.
 */
import type { ErrorDetail } from "./types";

const UNAUTHORIZED_EVENT = "entrelacs:unauthorized";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];

  constructor(status: number, code: string, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  token?: string | null;
}

export function onUnauthorized(listener: () => void): () => void {
  const handler = (): void => listener();
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}

async function parseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorFrom(status: number, body: unknown): ApiError {
  if (body !== null && typeof body === "object" && "error" in body) {
    const envelope = (body as { error: unknown }).error;
    if (envelope !== null && typeof envelope === "object" && "code" in envelope && "message" in envelope) {
      const shaped = envelope as { code: unknown; message: unknown; details?: unknown };
      return new ApiError(
        status,
        String(shaped.code),
        String(shaped.message),
        normalizeDetails(shaped.details),
      );
    }
  }
  return new ApiError(status, "http_error", `Request failed with status ${status}.`);
}

function normalizeDetails(value: unknown): ErrorDetail[] {
  if (!Array.isArray(value)) return [];
  const details: ErrorDetail[] = [];
  for (const item of value) {
    if (typeof item === "object" && item !== null && "field" in item && "message" in item) {
      const entry = item as { field: unknown; message: unknown };
      details.push({ field: String(entry.field), message: String(entry.message) });
    }
  }
  return details;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Cannot reach the server. Check your connection and try again.",
    );
  }
  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  const parsed = await parseBody(response);
  if (!response.ok) {
    throw errorFrom(response.status, parsed);
  }
  return parsed as T;
}
