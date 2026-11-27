"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ApiError, apiRequest } from "@/lib/portal/api";
import type { Me, OrganizationOption, TokenResponse } from "@/lib/portal/types";
import { session } from "@/lib/portal/session";
import { useToast } from "@/components/portal/ToastProvider";

interface SignUpScreenProps {
  onSignedIn: (user: Me, welcomeMessage?: string) => void;
  onSwitchToSignIn: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/** Maps 422 details (field "body.email") and 409 codes onto form field keys. */
function fieldErrorsFromApi(error: ApiError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const detail of error.details) {
    const key = detail.field.replace(/^body\./, "");
    if (key in errors) continue;
    errors[key] = detail.message;
  }
  if (error.code === "email_already_registered") {
    errors.email = "An account with this email already exists. Try signing in instead.";
  }
  return errors;
}

export function SignUpScreen({ onSignedIn, onSwitchToSignIn }: SignUpScreenProps): ReactNode {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [options, setOptions] = useState<OrganizationOption[] | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest<OrganizationOption[]>("/api/auth/options")
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch(() => {
        if (!cancelled) setOptionsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedOrganization = useMemo(
    () => options?.find((option) => option.id === organizationId) ?? null,
    [options, organizationId],
  );

  function clearFieldError(key: string): void {
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validateForm(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (confirmPassword !== password || confirmPassword.length === 0) {
      errors.confirmPassword = "Passwords do not match.";
    }
    if (organizationId === "") errors.organization_id = "Choose your organization.";
    if (teamId === "") errors.team_id = "Choose your team.";
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const clientErrors = validateForm();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setFieldErrors({});
    setBusy(true);
    try {
      const token = await apiRequest<TokenResponse>("/api/auth/register", {
        method: "POST",
        body: {
          email: email.trim(),
          password,
          role: "EMPLOYEE",
          organization_id: organizationId,
          team_id: teamId,
        },
      });
      session.set(token.access_token);
      const me = await apiRequest<Me>("/api/auth/me", { token: token.access_token });
      toast("Account created - welcome to the portal!", "success");
      onSignedIn(me, `Signed up as ${me.email}.`);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const apiFieldErrors = fieldErrorsFromApi(caught);
        if (Object.keys(apiFieldErrors).length > 0) {
          setFieldErrors(apiFieldErrors);
        } else {
          setError(caught.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const optionsLoaded = options !== null;
  const noOrganizations = optionsLoaded && options.length === 0;

  return (
    <div className="signin-wrap">
      <div className="signin-hero">
        <h1>Create your account</h1>
        <p>
          One account per person. Answer three questions a month; HR sees only the aggregate.
        </p>
      </div>

      <div className="card signin-card">
        <h2 className="card-title">Sign up</h2>
        <p className="card-sub">Your answers stay private - aggregates only, always.</p>

        {error ? (
          <div className="banner banner--error" role="alert" style={{ marginBottom: "1rem" }}>
            <span className="banner-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1.5A6.5 6.5 0 1 0 14.5 8 6.5 6.5 0 0 0 8 1.5ZM8 4a.9.9 0 0 1 .9.9V8a.9.9 0 1 1-1.8 0V4.9A.9.9 0 0 1 8 4Zm0 7.6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
              </svg>
            </span>
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="field">
            <label htmlFor="signup-email">Work email</label>
            <input
              id="signup-email"
              className="input"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFieldError("email");
              }}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
              required
            />
            {fieldErrors.email ? (
              <p className="field-error" id="signup-email-error">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError("password");
              }}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? "signup-password-error" : undefined}
              required
            />
            {fieldErrors.password ? (
              <p className="field-error" id="signup-password-error">{fieldErrors.password}</p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="signup-confirm">Confirm password</label>
            <input
              id="signup-confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                clearFieldError("confirmPassword");
              }}
              aria-invalid={fieldErrors.confirmPassword ? true : undefined}
              aria-describedby={fieldErrors.confirmPassword ? "signup-confirm-error" : undefined}
              required
            />
            {fieldErrors.confirmPassword ? (
              <p className="field-error" id="signup-confirm-error">
                {fieldErrors.confirmPassword}
              </p>
            ) : null}
          </div>

          {noOrganizations && !optionsError ? (
            <div className="banner banner--info" style={{ marginBottom: "1rem" }} role="status">
              <span>
                No organizations have been set up yet. Ask your HR team to provision the workspace,
                then try again.
              </span>
            </div>
          ) : null}
          {optionsError ? (
            <div className="banner banner--error" role="alert" style={{ marginBottom: "1rem" }}>
              <span>Could not load the organization list. Please refresh and try again.</span>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="signup-organization">Organization</label>
            <select
              id="signup-organization"
              className="input select"
              value={organizationId}
              disabled={!optionsLoaded || noOrganizations}
              onChange={(event) => {
                setOrganizationId(event.target.value);
                setTeamId("");
                clearFieldError("organization_id");
                clearFieldError("team_id");
              }}
              aria-invalid={fieldErrors.organization_id ? true : undefined}
              required
            >
              <option value="">
                {options === null
                  ? "Loading organizations…"
                  : noOrganizations
                    ? "No organizations yet"
                    : "Choose your organization"}
              </option>
              {(options ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            {fieldErrors.organization_id ? (
              <p className="field-error">{fieldErrors.organization_id}</p>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="signup-team">Team</label>
            <select
              id="signup-team"
              className="input select"
              value={teamId}
              disabled={selectedOrganization === null || selectedOrganization.teams.length === 0}
              onChange={(event) => {
                setTeamId(event.target.value);
                clearFieldError("team_id");
              }}
              aria-invalid={fieldErrors.team_id ? true : undefined}
              required
            >
              <option value="">
                {selectedOrganization === null
                  ? "Choose a team after picking an organization"
                  : selectedOrganization.teams.length === 0
                    ? "This organization has no teams yet"
                    : "Choose your team"}
              </option>
              {(selectedOrganization?.teams ?? []).map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            {fieldErrors.team_id ? <p className="field-error">{fieldErrors.team_id}</p> : null}
          </div>

          <button type="submit" className="btn btn--primary btn--wide" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" /> Creating account…
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <button type="button" className="link-btn" onClick={onSwitchToSignIn}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
