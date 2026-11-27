/** The three monthly questions, shared formatting helpers and the score preview. */
import type { AnswerKey } from "./types";

export interface Question {
  key: AnswerKey;
  label: string;
  help: string;
  accent: string;
}

export const QUESTIONS: Question[] = [
  {
    key: "connectedness",
    label: "Connection",
    help: "How connected do you feel to the people around you?",
    accent: "var(--c-teal)",
  },
  {
    key: "support",
    label: "Support",
    help: "How supported do you feel at work?",
    accent: "var(--c-green)",
  },
  {
    key: "workload",
    label: "Workload",
    help: "How manageable does your workload feel?",
    accent: "var(--c-navy)",
  },
];

export const QUESTION_KEYS: AnswerKey[] = QUESTIONS.map((question) => question.key);

export type Answers = Record<AnswerKey, number | null>;

export const EMPTY_ANSWERS: Answers = { connectedness: null, support: null, workload: null };

export function answersFrom(checkIn: {
  connectedness: number | null;
  support: number | null;
  workload: number | null;
}): Answers {
  return {
    connectedness: checkIn.connectedness,
    support: checkIn.support,
    workload: checkIn.workload,
  };
}

/** Client-side preview of the server's score: mean × 10, one decimal, half-up. */
export function projectScore(answers: Answers): number | null {
  const { connectedness, support, workload } = answers;
  if (connectedness === null || support === null || workload === null) {
    return null;
  }
  return Math.round(((connectedness + support + workload) * 100) / 3) / 10;
}

/** "2026-11-26T08:15:00.000Z" -> "26 Nov 2026, 08:15" in UTC. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

/** Format a YYYY-MM reporting period, such as "2026-11". */
export function formatMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
