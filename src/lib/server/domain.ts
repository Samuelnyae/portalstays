/**
 * Pure domain logic: wellbeing scoring and the monthly aggregate with the
 * minimum-respondent suppression threshold. No DB, no framework.
 */
import { MIN_RESPONDENTS, REPORTING_MONTH } from "./config";

export interface SubmittedRecord {
  employee_id: string;
  submitted_at: string; // ISO timestamp
  score: number;
}

export interface WellbeingSummary {
  respondent_count: number;
  eligible_count: number;
  participation_rate: number | null;
  average_score: number | null;
  suppressed: boolean;
}

function roundOneDecimal(value: number): number {
  // Half-up rounding to one decimal place.
  return Math.floor(value * 10 + 0.5) / 10;
}

/** ((connectedness + support + workload) / 3) * 10, rounded half-up to 1 dp. */
export function calculateScore(
  connectedness: number,
  support: number,
  workload: number,
): number {
  const total = connectedness + support + workload;
  return roundOneDecimal((total * 10) / 3);
}

/** The [start, end) UTC window of the fixed reporting month. */
function monthWindow(): { start: Date; end: Date } {
  const start = new Date(Date.UTC(REPORTING_MONTH.year, REPORTING_MONTH.month - 1, 1));
  const end =
    REPORTING_MONTH.month === 12
      ? new Date(Date.UTC(REPORTING_MONTH.year + 1, 0, 1))
      : new Date(Date.UTC(REPORTING_MONTH.year, REPORTING_MONTH.month, 1));
  return { start, end };
}

/**
 * Aggregate submitted check-ins for HR. Each employee counts once, using
 * their most recent submitted check-in inside the reporting month. Drafts
 * never reach this function. With fewer than MIN_RESPONDENTS respondents the
 * average is withheld, so no one's answers can be inferred.
 */
export function summarize(
  submissions: SubmittedRecord[],
  eligibleCount: number,
): WellbeingSummary {
  const { start, end } = monthWindow();

  // Filter to the window first, so an out-of-window submission can never
  // displace an in-window one.
  const latest = new Map<string, SubmittedRecord>();
  for (const record of submissions) {
    const at = new Date(record.submitted_at);
    if (Number.isNaN(at.getTime()) || at < start || at >= end) {
      continue;
    }
    const current = latest.get(record.employee_id);
    if (current === undefined || at > new Date(current.submitted_at)) {
      latest.set(record.employee_id, record);
    }
  }

  const respondents = latest.size;
  const participationRate =
    eligibleCount > 0 ? roundOneDecimal((respondents * 100) / eligibleCount) : null;
  const suppressed = respondents < MIN_RESPONDENTS;
  let averageScore: number | null = null;
  if (!suppressed && respondents > 0) {
    let sum = 0;
    for (const record of latest.values()) {
      sum += record.score;
    }
    averageScore = roundOneDecimal(sum / respondents);
  }

  return {
    respondent_count: respondents,
    eligible_count: eligibleCount,
    participation_rate: participationRate,
    average_score: averageScore,
    suppressed,
  };
}
