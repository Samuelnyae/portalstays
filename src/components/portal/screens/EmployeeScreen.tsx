"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, apiRequest } from "@/lib/portal/api";
import type { CheckIn, CurrentCheckIns } from "@/lib/portal/types";
import {
  EMPTY_ANSWERS,
  QUESTIONS,
  QUESTION_KEYS,
  answersFrom,
  formatDateTime,
  projectScore,
} from "@/lib/portal/questions";
import type { Answers } from "@/lib/portal/questions";
import { useToast } from "@/components/portal/ToastProvider";
import { AnswerSlider } from "@/components/portal/AnswerSlider";
import { ScoreGauge } from "@/components/portal/ScoreGauge";

export function EmployeeScreen({ token }: { token: string }): ReactNode {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CheckIn | null>(null);
  const [latestSubmitted, setLatestSubmitted] = useState<CheckIn | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [startingFresh, setStartingFresh] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      const current = await apiRequest<CurrentCheckIns>("/api/employee/check-ins/current", {
        token,
      });
      setDraft(current.draft);
      setLatestSubmitted(current.latest_submitted);
      setAnswers(current.draft ? answersFrom(current.draft) : EMPTY_ANSWERS);
      setStartingFresh(current.draft !== null);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status !== 401) {
        setLoadError(caught.message);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function setAnswer(key: keyof Answers, value: number): void {
    setFormError(null);
    setStartingFresh(true);
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  async function saveDraft(): Promise<CheckIn | null> {
    setFormError(null);
    setSavingDraft(true);
    try {
      const saved = await apiRequest<CheckIn>("/api/employee/check-ins/draft", {
        method: "PUT",
        token,
        body: {
          connectedness: answers.connectedness,
          support: answers.support,
          workload: answers.workload,
        },
      });
      setDraft(saved);
      toast("Draft saved - you can come back to it any time.", "success");
      return saved;
    } catch (caught) {
      if (caught instanceof ApiError && caught.status !== 401) {
        setFormError(caught.message);
      }
      return null;
    } finally {
      setSavingDraft(false);
    }
  }

  async function submit(): Promise<void> {
    setFormError(null);
    setSubmitting(true);
    try {
      let checkInId = draft?.id ?? null;
      if (checkInId === null) {
        const saved = await saveDraft();
        if (saved === null) return;
        checkInId = saved.id;
      }
      const submitted = await apiRequest<CheckIn>(
        `/api/employee/check-ins/${checkInId}/submit`,
        { method: "POST", token },
      );
      setLatestSubmitted(submitted);
      setDraft(null);
      setAnswers(EMPTY_ANSWERS);
      setStartingFresh(false);
      toast(
        submitted.score === null
          ? "Check-in submitted."
          : `Check-in submitted - your score is ${submitted.score.toFixed(1)}.`,
        "success",
      );
    } catch (caught) {
      if (caught instanceof ApiError && caught.status !== 401) {
        setFormError(caught.message);
        toast(caught.message, "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const previewScore = projectScore(answers);
  const allAnswered = QUESTION_KEYS.every((key) => answers[key] !== null);
  const showForm = draft !== null || latestSubmitted === null || startingFresh;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your monthly check-in</h1>
          <p>
            Three questions, 0 to 10. Higher means more positive. Only the latest submitted
            check-in in the month counts.
          </p>
        </div>
        {draft ? <span className="chip chip--lime">Draft in progress</span> : null}
      </div>

      <div className="employee-grid">
        <section aria-labelledby="checkin-form-title">
          {loading ? (
            <div className="skeleton" aria-hidden="true" />
          ) : loadError ? (
            <div className="card">
              <div className="banner banner--error" role="alert">
                <span>
                  <strong>Could not load your check-ins.</strong>
                  <br />
                  {loadError}
                </span>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => void load()}
                >
                  Try again
                </button>
              </div>
            </div>
          ) : showForm ? (
            <div className="card">
              <h2 className="card-title" id="checkin-form-title">
                {draft ? "Continue your check-in" : "Start a new check-in"}
              </h2>
              <p className="card-sub">
                {draft
                  ? `Draft saved ${formatDateTime(draft.updated_at)} - pick up where you left off.`
                  : "Your answers are kept as a draft until you submit. Nothing counts until then."}
              </p>

              {formError ? (
                <div className="banner banner--error" role="alert" style={{ marginBottom: "1rem" }}>
                  <span>{formError}</span>
                </div>
              ) : null}

              {QUESTIONS.map((question) => (
                <AnswerSlider
                  key={question.key}
                  question={question}
                  value={answers[question.key]}
                  onChange={(value) => setAnswer(question.key, value)}
                />
              ))}

              {previewScore !== null ? (
                <div className="score-preview">
                  <span className="score-preview-label">
                    Projected score
                    <span className="small muted" style={{ display: "block" }}>
                      The server calculates the final score on submit.
                    </span>
                  </span>
                  <span className="score-preview-value">{previewScore.toFixed(1)}</span>
                </div>
              ) : null}

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn--outline"
                  disabled={savingDraft || submitting}
                  onClick={() => void saveDraft()}
                >
                  {savingDraft ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> Saving…
                    </>
                  ) : (
                    "Save draft"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!allAnswered || savingDraft || submitting}
                  title={allAnswered ? undefined : "Answer all three questions to submit"}
                  onClick={() => void submit()}
                >
                  {submitting ? (
                    <>
                      <span className="spinner" aria-hidden="true" /> Submitting…
                    </>
                  ) : (
                    "Submit check-in"
                  )}
                </button>
              </div>

              <p className="meta-line">
                <span className="meta-dot" aria-hidden="true" />
                {allAnswered
                  ? "All three answers are in - submit when you are ready."
                  : "Answer all three questions to enable submit."}
              </p>
            </div>
          ) : (
            <div className="card">
              <h2 className="card-title">Check-in submitted</h2>
              <p className="card-sub">
                Submitted check-ins cannot be edited. You can start a new one at any time - only
                your latest submission in the month counts.
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setAnswers(EMPTY_ANSWERS);
                  setStartingFresh(true);
                }}
              >
                Start a new check-in
              </button>
            </div>
          )}
        </section>

        <section className="stack" aria-labelledby="latest-title">
          <div className="card">
            <h2 className="card-title" id="latest-title">
              Latest submitted check-in
            </h2>
            {latestSubmitted && latestSubmitted.submitted_at ? (
              <>
                <p className="card-sub">
                  Submitted {formatDateTime(latestSubmitted.submitted_at)} UTC
                </p>
                <ScoreGauge
                  score={latestSubmitted.score}
                  caption="Mean of the three answers, scaled to 100."
                />
                <div className="answer-chips">
                  {QUESTIONS.map((question) => {
                    const value = latestSubmitted[question.key];
                    return (
                      <span
                        key={question.key}
                        className="answer-chip"
                        style={{ "--question-accent": question.accent } as React.CSSProperties}
                      >
                        <span className="question-dot" aria-hidden="true" />
                        {question.label}
                        <b>{value === null ? "—" : `${value}/10`}</b>
                      </span>
                    );
                  })}
                </div>
                <p className="meta-line">
                  <span className="meta-dot" aria-hidden="true" />
                  Submitted answers are read-only and cannot be edited.
                </p>
              </>
            ) : (
              <p className="muted small">
                Nothing submitted yet this month. Your first submitted check-in will appear here
                with its score.
              </p>
            )}
          </div>

          <div className="card">
            <h2 className="card-title">How it works</h2>
            <ul className="rules-list">
              <li>
                <span
                  className="question-dot"
                  style={{ background: "var(--c-teal)" }}
                  aria-hidden="true"
                />
                Save an incomplete draft and resume after a refresh or a new sign-in.
              </li>
              <li>
                <span
                  className="question-dot"
                  style={{ background: "var(--c-green)" }}
                  aria-hidden="true"
                />
                The score is the mean of the three answers, scaled to 100 and rounded to one
                decimal.
              </li>
              <li>
                <span
                  className="question-dot"
                  style={{ background: "var(--c-navy)" }}
                  aria-hidden="true"
                />
                HR never sees individual answers, only the aggregate for your organization.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
