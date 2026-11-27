/**
 * HTTP routes for the wellbeing API. Authorization is enforced before any
 * lookup happens, and every error uses one envelope:
 * {"error": {"code", "message"}} (+ details for 422).
 * Ported 1:1 from the original Bun server; served through Next.js API routes.
 */
import {
  CheckInAlreadySubmittedError,
  ConcurrentDraftError,
  EmailAlreadyRegisteredError,
  ForbiddenError,
  IncompleteCheckInError,
  NotFoundError,
  NotAuthenticatedError,
  InvalidCredentialsError,
  ValidationError,
  shapeFor,
} from "./errors";
import type { ValidationErrorDetail } from "./errors";
import { calculateScore, summarize } from "./domain";
import { Repository } from "./repository";
import type { CheckInRow, UserRow } from "./repository";
import { TokenService, TokenError } from "./tokens";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./passwords";
import { ensureDatabase } from "./pg";
import type { DbPool } from "./pool";
import {
  validateDraft,
  validateLogin,
  validateRegister,
  requireUuid,
  validationError,
} from "./validation";
import { REPORTING_MONTH } from "./config";

interface HttpResponse {
  status: number;
  body: unknown;
}

function response(status: number, body: unknown): HttpResponse {
  return { status, body };
}

function errorResponse(error: unknown): HttpResponse {
  const shape = shapeFor(error);
  if (shape !== null) {
    const detail: Record<string, unknown> = { code: shape.code, message: shape.message };
    if (error instanceof ValidationError) {
      detail.details = error.details;
    }
    return response(shape.status, { error: detail });
  }
  console.error("unexpected error:", error);
  return response(500, { error: { code: "internal_error", message: "internal server error" } });
}

export interface AppState {
  repo: Repository;
  tokens: TokenService;
  dummyHash: string;
}

const globalState = globalThis as unknown as {
  __wellbeingState?: Promise<AppState> | undefined;
};

/** Boots the database once and hands back the shared application state. */
export function getAppState(): Promise<AppState> {
  globalState.__wellbeingState ??= (async () => {
    const pool: DbPool = await ensureDatabase();
    return {
      repo: new Repository(pool),
      tokens: new TokenService(),
      dummyHash: dummyPasswordHash(),
    };
  })();
  return globalState.__wellbeingState;
}

async function authenticate(state: AppState, request: Request): Promise<UserRow> {
  const header = request.headers.get("authorization");
  if (header === null || !header.startsWith("Bearer ")) {
    throw new NotAuthenticatedError("missing bearer token");
  }
  const token = header.slice("Bearer ".length).trim();
  let userId: string;
  try {
    userId = state.tokens.verify(token, new Date());
  } catch (error) {
    if (error instanceof TokenError) {
      throw new NotAuthenticatedError("invalid token");
    }
    throw error;
  }
  const user = await state.repo.getUser(userId);
  if (user === null) {
    throw new NotAuthenticatedError("unknown user");
  }
  return user;
}

function requireEmployee(user: UserRow): void {
  if (user.role !== "EMPLOYEE") {
    throw new ForbiddenError("employee role required");
  }
}

function requireHr(user: UserRow): void {
  if (user.role !== "HR") {
    throw new ForbiddenError("HR role required");
  }
}

// --- serialization --------------------------------------------------------------------------

interface CheckInJson {
  id: string;
  status: string;
  connectedness: number | null;
  support: number | null;
  workload: number | null;
  score: number | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

function checkInJson(row: CheckInRow): CheckInJson {
  return {
    id: row.id,
    status: row.status,
    connectedness: row.connectedness,
    support: row.support,
    workload: row.workload,
    score: row.score,
    created_at: row.created_at,
    updated_at: row.updated_at,
    submitted_at: row.submitted_at,
  };
}

function meJson(user: UserRow): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    organization_id: user.organization_id,
    team_id: user.team_id,
  };
}

// --- application services -------------------------------------------------------------------

async function currentCheckIns(
  repo: Repository,
  user: UserRow,
): Promise<Record<string, unknown>> {
  const draft = await repo.findDraft(user.id);
  const latestSubmitted = await repo.findLatestSubmitted(user.id);
  return {
    draft: draft ? checkInJson(draft) : null,
    latest_submitted: latestSubmitted ? checkInJson(latestSubmitted) : null,
  };
}

async function saveDraft(
  repo: Repository,
  user: UserRow,
  input: { connectedness: number | null; support: number | null; workload: number | null },
): Promise<CheckInRow> {
  const now = new Date().toISOString();
  const draft = await repo.findDraft(user.id);
  if (draft === null) {
    const fresh: CheckInRow = {
      id: crypto.randomUUID(),
      employee_id: user.id,
      organization_id: user.organization_id,
      team_id: user.team_id ?? "",
      connectedness: input.connectedness,
      support: input.support,
      workload: input.workload,
      score: null,
      status: "DRAFT",
      created_at: now,
      updated_at: now,
      submitted_at: null,
    };
    try {
      await repo.insertDraftRow(fresh);
    } catch (error) {
      // Another request created this employee's draft first.
      if (
        error instanceof Error &&
        (error.message.includes("duplicate key") || error.message.includes("unique"))
      ) {
        throw new ConcurrentDraftError("a draft already exists for this employee");
      }
      throw error;
    }
    return fresh;
  }
  const updated = await repo.updateDraftAnswers(draft.id, input, now);
  if (!updated) {
    throw new CheckInAlreadySubmittedError("check-in was already submitted");
  }
  const refreshed = await repo.findDraft(user.id);
  if (refreshed === null) {
    throw new NotFoundError("check-in not found");
  }
  return refreshed;
}

async function submitCheckIn(
  repo: Repository,
  user: UserRow,
  checkInId: string,
): Promise<CheckInRow> {
  const checkIn = await repo.findByIdForEmployee(checkInId, user.id);
  if (checkIn === null) {
    throw new NotFoundError("check-in not found");
  }
  if (checkIn.status === "SUBMITTED") {
    throw new CheckInAlreadySubmittedError("a submitted check-in cannot be changed");
  }
  const { connectedness, support, workload } = checkIn;
  if (connectedness === null || support === null || workload === null) {
    throw new IncompleteCheckInError("all three answers are required to submit");
  }
  const now = new Date().toISOString();
  const updated = await repo.submitRow(
    checkIn.id,
    calculateScore(connectedness, support, workload),
    now,
  );
  if (!updated) {
    throw new CheckInAlreadySubmittedError("a submitted check-in cannot be changed");
  }
  const refreshed = await repo.findByIdForEmployee(checkIn.id, user.id);
  if (refreshed === null) {
    throw new NotFoundError("check-in not found");
  }
  return refreshed;
}

// --- the router -------------------------------------------------------------------------------

async function readBodyJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (text.trim().length === 0) {
      return {};
    }
    return JSON.parse(text) as unknown;
  } catch {
    throw validationError([{ field: "body", message: "Input should be a valid JSON" }]);
  }
}

export async function handle(state: AppState, request: Request): Promise<HttpResponse> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;

  try {
    // Health probe.
    if (path === "/api" || path === "/api/health") {
      if (method !== "GET") {
        return response(405, { error: { code: "http_error", message: "Method Not Allowed" } });
      }
      return response(200, { name: "entrelacs-wellbeing-api", status: "ok" });
    }

    if (path === "/api/auth/login") {
      if (method !== "POST") {
        return response(405, { error: { code: "http_error", message: "Method Not Allowed" } });
      }
      const input = validateLogin(await readBodyJson(request));
      const user = await state.repo.getUserByEmail(input.email);
      const ok = await verifyPassword(input.password, user?.password_hash ?? state.dummyHash);
      if (user === null || !ok) {
        // One error for wrong password and unknown email.
        throw new InvalidCredentialsError("invalid credentials");
      }
      return response(200, {
        access_token: state.tokens.issue(user.id, new Date()),
        token_type: "bearer",
      });
    }

    if (path === "/api/auth/me") {
      if (method !== "GET") {
        return response(405, { error: { code: "http_error", message: "Method Not Allowed" } });
      }
      const user = await authenticate(state, request);
      return response(200, meJson(user));
    }

    if (path === "/api/auth/options") {
      if (method !== "GET") {
        return response(405, { error: { code: "http_error", message: "Method Not Allowed" } });
      }
      // Public: the sign-up form needs the organizations employees can join.
      return response(200, await state.repo.listOrganizationOptions());
    }

    if (path === "/api/auth/register") {
      if (method !== "POST") {
        return response(405, { error: { code: "http_error", message: "Method Not Allowed" } });
      }
      const input = validateRegister(await readBodyJson(request));
      if ((await state.repo.getUserByEmail(input.email)) !== null) {
        throw new EmailAlreadyRegisteredError("an account with this email already exists");
      }
      if ((await state.repo.getOrganization(input.organization_id)) === null) {
        throw validationError([{ field: "body.organization_id", message: "Unknown organization" }]);
      }
      if (!(await state.repo.teamInOrganization(input.team_id, input.organization_id))) {
        throw validationError([
          { field: "body.team_id", message: "Unknown team for this organization" },
        ]);
      }
      const passwordHash = await hashPassword(input.password);
      const user = await state.repo.createEmployeeUser({
        organizationId: input.organization_id,
        teamId: input.team_id,
        email: input.email,
        passwordHash,
      });
      return response(201, {
        access_token: state.tokens.issue(user.id, new Date()),
        token_type: "bearer",
      });
    }

    if (path === "/api/employee/check-ins/current") {
      if (method !== "GET") {
        return response(405, { error: { code: "http_error", message: "Method Not Allowed" } });
      }
      const user = await authenticate(state, request);
      requireEmployee(user);
      return response(200, await currentCheckIns(state.repo, user));
    }

    if (path === "/api/employee/check-ins/draft") {
      if (method !== "PUT") {
        return response(405, { error: { code: "http_error", message: "Method Not Allowed" } });
      }
      const user = await authenticate(state, request);
      requireEmployee(user);
      const input = validateDraft(await readBodyJson(request));
      const draft = await saveDraft(state.repo, user, input);
      return response(200, checkInJson(draft));
    }

    const submitMatch = /^\/api\/employee\/check-ins\/([^/]+)\/submit$/.exec(path);
    if (submitMatch !== null) {
      if (method !== "POST") {
        return response(405, { error: { code: "http_error", message: "Method Not Allowed" } });
      }
      const user = await authenticate(state, request);
      requireEmployee(user);
      const checkInId = requireUuid(submitMatch[1], "path.check_in_id");
      const submitted = await submitCheckIn(state.repo, user, checkInId);
      return response(200, checkInJson(submitted));
    }

    const checkInMatch = /^\/api\/employee\/check-ins\/([^/]+)$/.exec(path);
    if (checkInMatch !== null) {
      if (method !== "GET") {
        return response(405, { error: { code: "http_error", message: "Method Not Allowed" } });
      }
      const user = await authenticate(state, request);
      requireEmployee(user);
      const checkInId = requireUuid(checkInMatch[1], "path.check_in_id");
      const checkIn = await state.repo.findByIdForEmployee(checkInId, user.id);
      if (checkIn === null) {
        throw new NotFoundError("check-in not found");
      }
      return response(200, checkInJson(checkIn));
    }

    if (path === "/api/hr/wellbeing") {
      if (method !== "GET") {
        return response(405, { error: { code: "http_error", message: "Method Not Allowed" } });
      }
      const user = await authenticate(state, request);
      requireHr(user);
      const teamIdRaw = url.searchParams.get("team_id");
      const teamId = teamIdRaw === null ? null : requireUuid(teamIdRaw, "query.team_id");
      if (teamId !== null && !(await state.repo.teamInOrganization(teamId, user.organization_id))) {
        // 404 instead of 403: do not confirm that another organization's team exists.
        throw new NotFoundError("team not found");
      }
      const records = await state.repo.submittedRecords(user.organization_id, teamId);
      const eligible = await state.repo.eligibleCount(user.organization_id, teamId);
      const aggregate = summarize(records, eligible);
      return response(200, {
        reporting_month: `${REPORTING_MONTH.year}-${String(REPORTING_MONTH.month).padStart(2, "0")}`,
        team_id: teamId,
        respondent_count: aggregate.respondent_count,
        eligible_count: aggregate.eligible_count,
        participation_rate: aggregate.participation_rate,
        average_score: aggregate.average_score,
        suppressed: aggregate.suppressed,
      });
    }

    if (path === "/api/hr/teams") {
      if (method !== "GET") {
        return response(405, { error: { code: "http_error", message: "Method Not Allowed" } });
      }
      const user = await authenticate(state, request);
      requireHr(user);
      return response(200, await state.repo.listTeams(user.organization_id));
    }

    if (path.startsWith("/api/")) {
      return response(404, { error: { code: "http_error", message: "Not Found" } });
    }

    return response(404, { error: { code: "http_error", message: "Not Found" } });
  } catch (error) {
    return errorResponse(error);
  }
}
