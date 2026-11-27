/** Shapes returned by the wellbeing API. Ownership and the score are never client-supplied. */

export type Role = "EMPLOYEE" | "HR";
export type CheckInStatus = "DRAFT" | "SUBMITTED";
export type AnswerKey = "connectedness" | "support" | "workload";

export interface Me {
  id: string;
  email: string;
  role: Role;
  organization_id: string;
  team_id: string | null;
}

export interface CheckIn {
  id: string;
  status: CheckInStatus;
  connectedness: number | null;
  support: number | null;
  workload: number | null;
  score: number | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

export interface CurrentCheckIns {
  draft: CheckIn | null;
  latest_submitted: CheckIn | null;
}

export interface Team {
  id: string;
  name: string;
}

/** An organization and its teams, as offered on the sign-up form. */
export interface OrganizationOption {
  id: string;
  name: string;
  teams: Team[];
}

export interface WellbeingSummary {
  reporting_month: string;
  team_id: string | null;
  respondent_count: number;
  eligible_count: number;
  participation_rate: number | null;
  average_score: number | null;
  suppressed: boolean;
}

export interface ErrorDetail {
  field: string;
  message: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
}
