/** Runtime settings for the wellbeing portal API. */

/** Access tokens last 30 minutes; the browser keeps the token for the tab only. */
export const TOKEN_TTL_SECONDS = 30 * 60;

/** Fixed reporting month: October 2026, from the first day to the end of the month, UTC. */
export const REPORTING_MONTH: { year: number; month: number } = { year: 2026, month: 10 };

/** With fewer respondents than this, the aggregate average is withheld. */
export const MIN_RESPONDENTS = 5;

/** Minimum password length accepted at sign-up. */
export const MIN_PASSWORD_LENGTH = 8;

/** HS256 signing key. Override with the JWT_SECRET environment variable. */
export const JWT_SECRET =
  process.env.JWT_SECRET ?? "entrelacs-local-signing-key-0123456789abcdef-change-me";
