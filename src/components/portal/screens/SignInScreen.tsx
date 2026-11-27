"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ApiError, apiRequest } from "@/lib/portal/api";
import type { Me, TokenResponse } from "@/lib/portal/types";
import { session } from "@/lib/portal/session";

interface SignInScreenProps {
  onSignedIn: (user: Me) => void;
  onSwitchToSignUp: () => void;
}

export function SignInScreen({ onSignedIn, onSwitchToSignUp }: SignInScreenProps): ReactNode {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const token = await apiRequest<TokenResponse>("/api/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      session.set(token.access_token);
      const me = await apiRequest<Me>("/api/auth/me", { token: token.access_token });
      onSignedIn(me);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(
          caught.code === "invalid_credentials"
            ? "Invalid email or password."
            : caught.message,
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin-wrap">
      <div className="signin-hero">
        <h1>Private Monthly Check-In</h1>
        <p>
          Share your monthly pulse in seconds. HR sees thresholded team averages, never personal
          answers
        </p>
      </div>

      <div className="card signin-card">
        <h2 className="card-title">Sign in</h2>
        <p className="card-sub">Welcome back. Sign in with your work account.</p>

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
            <label htmlFor="signin-email">Work email</label>
            <input
              id="signin-email"
              className="input"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={error ? true : undefined}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="signin-password">Password</label>
            <input
              id="signin-password"
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={error ? true : undefined}
              required
            />
          </div>
          <button type="submit" className="btn btn--primary btn--wide" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" /> Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="auth-switch">
          New to the portal?{" "}
          <button type="button" className="link-btn" onClick={onSwitchToSignUp}>
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}
