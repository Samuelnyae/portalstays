/**
 * PostgreSQL persistence: account creation and tenant-scoped queries.
 * Ported 1:1 from the original Bun/SQLite repository; ownership and the
 * score are never client-supplied.
 */
import { randomUUID } from "node:crypto";
import type { DbPool } from "./pool";
import { EmailAlreadyRegisteredError } from "./errors";

export type Role = "EMPLOYEE" | "HR";
export type CheckInStatus = "DRAFT" | "SUBMITTED";

export interface UserRow {
  id: string;
  organization_id: string;
  team_id: string | null;
  email: string;
  password_hash: string;
  role: Role;
}

export interface CheckInRow {
  id: string;
  employee_id: string;
  organization_id: string;
  team_id: string;
  connectedness: number | null;
  support: number | null;
  workload: number | null;
  score: number | null;
  status: CheckInStatus;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

export interface OrganizationOptionRow {
  id: string;
  name: string;
  teams: Array<{ id: string; name: string }>;
}

export interface SubmittedRecordRow {
  employee_id: string;
  submitted_at: string;
  score: number;
}

export interface TeamRecordRow {
  id: string;
  name: string;
}

const USER_COLUMNS = "id, organization_id, team_id, email, password_hash, role";
const CHECK_IN_COLUMNS =
  "id, employee_id, organization_id, team_id, connectedness, support, workload, score, status, created_at, updated_at, submitted_at";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

export class Repository {
  private readonly pool: DbPool;

  constructor(pool: DbPool) {
    this.pool = pool;
  }

  async getUserByEmail(email: string): Promise<UserRow | null> {
    const result = await this.pool.query(
      `select ${USER_COLUMNS} from users where lower(email) = lower($1) limit 1`,
      [email],
    );
    return (result.rows[0] as UserRow | undefined) ?? null;
  }

  async getUser(userId: string): Promise<UserRow | null> {
    const result = await this.pool.query(
      `select ${USER_COLUMNS} from users where id = $1 limit 1`,
      [userId],
    );
    return (result.rows[0] as UserRow | undefined) ?? null;
  }

  async getOrganization(organizationId: string): Promise<{ id: string; name: string } | null> {
    const result = await this.pool.query(
      "select id, name from organizations where id = $1 limit 1",
      [organizationId],
    );
    return (result.rows[0] as { id: string; name: string } | undefined) ?? null;
  }

  async organizationNameExists(name: string): Promise<boolean> {
    const result = await this.pool.query(
      "select 1 as ok from organizations where lower(name) = lower($1) limit 1",
      [name],
    );
    return result.rowCount > 0;
  }

  async findOrganizationByName(name: string): Promise<{ id: string; name: string } | null> {
    const result = await this.pool.query(
      "select id, name from organizations where lower(name) = lower($1) limit 1",
      [name],
    );
    return (result.rows[0] as { id: string; name: string } | undefined) ?? null;
  }

  /** Insert the team when its name is free; an existing name wins silently. */
  async ensureTeam(organizationId: string, name: string): Promise<void> {
    await this.pool.query(
      "insert into teams (id, organization_id, name) values ($1, $2, $3) on conflict do nothing",
      [randomUUID(), organizationId, name],
    );
  }

  /** Organizations with their teams, for the public sign-up form. Ordered by name. */
  async listOrganizationOptions(): Promise<OrganizationOptionRow[]> {
    const organizations = await this.pool.query(
      "select id, name from organizations order by lower(name)",
    );
    const teams = await this.pool.query(
      "select id, organization_id, name from teams order by lower(name)",
    );
    return organizations.rows.map((organization) => {
      const row = organization as { id: string; name: string };
      return {
        id: row.id,
        name: row.name,
        teams: teams.rows
          .map((t) => t as { id: string; organization_id: string; name: string })
          .filter((team) => team.organization_id === row.id)
          .map((team) => ({ id: team.id, name: team.name })),
      };
    });
  }

  /** Create one EMPLOYEE user. A racing duplicate email surfaces as a conflict error. */
  async createEmployeeUser(input: {
    organizationId: string;
    teamId: string;
    email: string;
    passwordHash: string;
  }): Promise<UserRow> {
    const user: UserRow = {
      id: randomUUID(),
      organization_id: input.organizationId,
      team_id: input.teamId,
      email: input.email,
      password_hash: input.passwordHash,
      role: "EMPLOYEE",
    };
    try {
      await this.pool.query(
        "insert into users (id, organization_id, team_id, email, password_hash, role) values ($1, $2, $3, $4, $5, 'EMPLOYEE')",
        [user.id, user.organization_id, user.team_id, user.email, user.password_hash],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new EmailAlreadyRegisteredError("an account with this email already exists");
      }
      throw error;
    }
    return user;
  }

  /** Create one HR user on an existing organization (no team). */
  async createHrUser(input: {
    organizationId: string;
    email: string;
    passwordHash: string;
  }): Promise<UserRow> {
    const user: UserRow = {
      id: randomUUID(),
      organization_id: input.organizationId,
      team_id: null,
      email: input.email,
      password_hash: input.passwordHash,
      role: "HR",
    };
    try {
      await this.pool.query(
        "insert into users (id, organization_id, team_id, email, password_hash, role) values ($1, $2, null, $3, $4, 'HR')",
        [user.id, user.organization_id, user.email, user.password_hash],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new EmailAlreadyRegisteredError("an account with this email already exists");
      }
      throw error;
    }
    return user;
  }

  /**
   * Create a new organization with its teams and the HR account that owns it,
   * in one transaction: a partial workspace can never exist.
   */
  async createHrWorkspace(input: {
    email: string;
    passwordHash: string;
    organizationName: string;
    teamNames: string[];
  }): Promise<{ user: UserRow; organizationId: string }> {
    const organizationId = randomUUID();
    const userId = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("insert into organizations (id, name) values ($1, $2)", [
        organizationId,
        input.organizationName,
      ]);
      for (const teamName of input.teamNames) {
        await client.query("insert into teams (id, organization_id, name) values ($1, $2, $3)", [
          randomUUID(),
          organizationId,
          teamName,
        ]);
      }
      await client.query(
        "insert into users (id, organization_id, team_id, email, password_hash, role) values ($1, $2, null, $3, $4, 'HR')",
        [userId, organizationId, input.email, input.passwordHash],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      if (isUniqueViolation(error)) {
        throw new EmailAlreadyRegisteredError("an account with this email already exists");
      }
      throw error;
    } finally {
      client.release();
    }
    return {
      user: {
        id: userId,
        organization_id: organizationId,
        team_id: null,
        email: input.email,
        password_hash: input.passwordHash,
        role: "HR",
      },
      organizationId,
    };
  }

  async findDraft(employeeId: string): Promise<CheckInRow | null> {
    const result = await this.pool.query(
      `select ${CHECK_IN_COLUMNS} from check_ins where employee_id = $1 and status = 'DRAFT' limit 1`,
      [employeeId],
    );
    return (result.rows[0] as CheckInRow | undefined) ?? null;
  }

  async findByIdForEmployee(checkInId: string, employeeId: string): Promise<CheckInRow | null> {
    const result = await this.pool.query(
      `select ${CHECK_IN_COLUMNS} from check_ins where id = $1 and employee_id = $2 limit 1`,
      [checkInId, employeeId],
    );
    return (result.rows[0] as CheckInRow | undefined) ?? null;
  }

  async findLatestSubmitted(employeeId: string): Promise<CheckInRow | null> {
    const result = await this.pool.query(
      `select ${CHECK_IN_COLUMNS} from check_ins
       where employee_id = $1 and status = 'SUBMITTED'
       order by submitted_at desc limit 1`,
      [employeeId],
    );
    return (result.rows[0] as CheckInRow | undefined) ?? null;
  }

  /** Insert a new draft. A racing first save surfaces as a unique-violation error. */
  async insertDraftRow(checkIn: CheckInRow): Promise<void> {
    await this.pool.query(
      `insert into check_ins (id, employee_id, organization_id, team_id, connectedness, support,
         workload, score, status, created_at, updated_at, submitted_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        checkIn.id,
        checkIn.employee_id,
        checkIn.organization_id,
        checkIn.team_id,
        checkIn.connectedness,
        checkIn.support,
        checkIn.workload,
        checkIn.score,
        checkIn.status,
        checkIn.created_at,
        checkIn.updated_at,
        checkIn.submitted_at,
      ],
    );
  }

  /**
   * Update a DRAFT row, applying only the provided (non-null) answers.
   * A row that is already SUBMITTED is never touched.
   */
  async updateDraftAnswers(
    checkInId: string,
    answers: { connectedness: number | null; support: number | null; workload: number | null },
    updatedAt: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `update check_ins set
         connectedness = coalesce($1, connectedness),
         support = coalesce($2, support),
         workload = coalesce($3, workload),
         updated_at = $4
       where id = $5 and status = 'DRAFT'`,
      [answers.connectedness, answers.support, answers.workload, updatedAt, checkInId],
    );
    return result.rowCount > 0;
  }

  async submitRow(checkInId: string, score: number, submittedAt: string): Promise<boolean> {
    const result = await this.pool.query(
      `update check_ins set status = 'SUBMITTED', score = $1, submitted_at = $2, updated_at = $3
       where id = $4 and status = 'DRAFT'`,
      [score, submittedAt, submittedAt, checkInId],
    );
    return result.rowCount > 0;
  }

  async submittedRecords(organizationId: string, teamId: string | null): Promise<SubmittedRecordRow[]> {
    if (teamId) {
      const result = await this.pool.query(
        `select employee_id, submitted_at, score from check_ins
         where organization_id = $1 and team_id = $2 and status = 'SUBMITTED'`,
        [organizationId, teamId],
      );
      return result.rows as SubmittedRecordRow[];
    }
    const result = await this.pool.query(
      `select employee_id, submitted_at, score from check_ins
       where organization_id = $1 and status = 'SUBMITTED'`,
      [organizationId],
    );
    return result.rows as SubmittedRecordRow[];
  }

  async eligibleCount(organizationId: string, teamId: string | null): Promise<number> {
    const params: unknown[] = [organizationId];
    let sql = "select count(*) as n from users where organization_id = $1 and role = 'EMPLOYEE'";
    if (teamId) {
      sql += " and team_id = $2";
      params.push(teamId);
    }
    const result = await this.pool.query(sql, params);
    return Number((result.rows[0] as { n: number }).n);
  }

  async teamInOrganization(teamId: string, organizationId: string): Promise<boolean> {
    const result = await this.pool.query(
      "select 1 as ok from teams where id = $1 and organization_id = $2 limit 1",
      [teamId, organizationId],
    );
    return result.rowCount > 0;
  }

  async listTeams(organizationId: string): Promise<TeamRecordRow[]> {
    const result = await this.pool.query(
      "select id, name from teams where organization_id = $1 order by lower(name)",
      [organizationId],
    );
    return result.rows as TeamRecordRow[];
  }
}
