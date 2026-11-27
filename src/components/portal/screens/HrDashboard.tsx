"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, apiRequest } from "@/lib/portal/api";
import type { Team, WellbeingSummary } from "@/lib/portal/types";
import { formatMonth } from "@/lib/portal/questions";

const ALL_TEAMS = "all";
/** Kept in sync with the server's suppression threshold. */
const MIN_RESPONDENTS = 5;

function Swatch({
  tone,
  label,
  value,
  valueIsText = false,
  sub,
}: {
  tone: "navy" | "teal" | "green" | "lime";
  label: string;
  value: string;
  valueIsText?: boolean;
  sub: string;
}): ReactNode {
  return (
    <article className={`swatch swatch--${tone}`}>
      <span className="swatch-label">{label}</span>
      <span className={`swatch-value${valueIsText ? " swatch-value--text" : ""}`}>{value}</span>
      <span className="swatch-sub">{sub}</span>
      <span className="swatch-dot" aria-hidden="true" />
    </article>
  );
}

export function HrDashboard({ token }: { token: string }): ReactNode {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState(ALL_TEAMS);
  const [summary, setSummary] = useState<WellbeingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTeams = useCallback(async (): Promise<void> => {
    setTeamsError(null);
    try {
      const list = await apiRequest<Team[]>("/api/hr/teams", { token });
      setTeams(list);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status !== 401) {
        setTeamsError(caught.message);
      }
    }
  }, [token]);

  const loadSummary = useCallback(
    async (team: string): Promise<void> => {
      setLoading(true);
      setLoadError(null);
      try {
        const query = team === ALL_TEAMS ? "" : `?team_id=${encodeURIComponent(team)}`;
        const data = await apiRequest<WellbeingSummary>(`/api/hr/wellbeing${query}`, { token });
        setSummary(data);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status !== 401) {
          setLoadError(caught.message);
          setSummary(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadTeams();
    void loadSummary(ALL_TEAMS);
  }, [loadTeams, loadSummary]);

  function selectTeam(team: string): void {
    setSelectedTeam(team);
    void loadSummary(team);
  }

  const scopeLabel =
    selectedTeam === ALL_TEAMS
      ? "your organization"
      : (teams.find((team) => team.id === selectedTeam)?.name ?? "the selected team");

  const participationText =
    summary === null
      ? null
      : summary.participation_rate === null
        ? "No eligible employees"
        : `${summary.participation_rate.toFixed(1)}%`;
  const averageText =
    summary === null
      ? null
      : summary.suppressed || summary.average_score === null
        ? "Insufficient responses"
        : `${summary.average_score.toFixed(1)} / 100`;
  const participationPercent =
    summary === null || summary.participation_rate === null
      ? 0
      : Math.max(0, Math.min(100, summary.participation_rate));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Wellbeing overview</h1>
          <p>
            Aggregate results for {scopeLabel}. HR responses contain no individual answers, scores
            or employee identifiers.
          </p>
        </div>
        {summary ? (
          <span className="chip chip--glass">Reporting month: {formatMonth(summary.reporting_month)}</span>
        ) : null}
      </div>

      <div className="filter-row">
        <label htmlFor="team-filter">Filter by team</label>
        <select
          id="team-filter"
          className="select"
          value={selectedTeam}
          onChange={(event) => selectTeam(event.target.value)}
        >
          <option value={ALL_TEAMS}>All teams</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        {teamsError ? (
          <span className="small" style={{ color: "var(--danger)" }}>
            Could not load teams: {teamsError}
          </span>
        ) : null}
      </div>

      {loading && summary === null ? (
        <div className="swatch-grid" aria-hidden="true">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : loadError ? (
        <div className="card" role="alert">
          <div className="banner banner--error">
            <span>
              <strong>Could not load the aggregate.</strong>
              <br />
              {loadError}
            </span>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => void loadSummary(selectedTeam)}
            >
              Try again
            </button>
          </div>
        </div>
      ) : summary ? (
        <>
          <div className={`swatch-grid${loading ? " skeleton-loading" : ""}`}>
            <Swatch
              tone="navy"
              label="Respondents"
              value={String(summary.respondent_count)}
              sub="submitted this month"
            />
            <Swatch
              tone="teal"
              label="Eligible employees"
              value={String(summary.eligible_count)}
              sub={selectedTeam === ALL_TEAMS ? "across all teams" : "in this team"}
            />
            <Swatch
              tone="green"
              label="Participation"
              value={participationText ?? "—"}
              valueIsText={summary.participation_rate === null}
              sub={
                summary.eligible_count === 0
                  ? "respondents ÷ eligible employees"
                  : `${summary.respondent_count} of ${summary.eligible_count} eligible`
              }
            />
            <Swatch
              tone="lime"
              label="Average score"
              value={averageText ?? "—"}
              valueIsText={summary.suppressed || summary.average_score === null}
              sub={
                summary.suppressed
                  ? `hidden below ${MIN_RESPONDENTS} respondents`
                  : "mean of the latest scores"
              }
            />
          </div>

          {summary.eligible_count > 0 ? (
            <div className="card" style={{ marginBottom: "1.25rem" }}>
              <h2 className="card-title">Participation</h2>
              <p className="card-sub">Respondents divided by eligible employees.</p>
              <div
                className="participation-bar"
                role="img"
                aria-label={`Participation ${participationPercent.toFixed(1)} percent`}
              >
                <div
                  className="participation-bar-fill"
                  style={{ width: `${participationPercent}%` }}
                />
              </div>
              <p className="meta-line">
                <span className="meta-dot" aria-hidden="true" />
                {participationPercent.toFixed(1)}% - {summary.respondent_count} respondent
                {summary.respondent_count === 1 ? "" : "s"} out of {summary.eligible_count}{" "}
                eligible employee{summary.eligible_count === 1 ? "" : "s"}.
              </p>
            </div>
          ) : null}

          <div className="card">
            <h2 className="card-title">About these results</h2>
            <ul className="rules-list">
              <li>
                <span
                  className="question-dot"
                  style={{ background: "var(--c-teal)" }}
                  aria-hidden="true"
                />
                Each employee counts once, using their most recent submitted check-in in the
                reporting month. Drafts never count.
              </li>
              <li>
                <span
                  className="question-dot"
                  style={{ background: "var(--c-green)" }}
                  aria-hidden="true"
                />
                With fewer than 5 respondents the average is withheld and shown as &ldquo;Insufficient
                responses&rdquo;. Respondent counts and participation still show.
              </li>
              <li>
                <span
                  className="question-dot"
                  style={{ background: "var(--c-navy)" }}
                  aria-hidden="true"
                />
                The average shows only when at least 5 employees responded, so no one&rsquo;s answers
                can be inferred from the aggregate.
              </li>
              <li>
                <span
                  className="question-dot"
                  style={{ background: "var(--c-lime)" }}
                  aria-hidden="true"
                />
                Participation shows &ldquo;No eligible employees&rdquo; when a team has no employees in
                scope.
              </li>
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
}
