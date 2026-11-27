"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, apiRequest, onUnauthorized } from "@/lib/portal/api";
import type { Me } from "@/lib/portal/types";
import { session } from "@/lib/portal/session";
import { TopBar } from "@/components/portal/TopBar";
import { ToastProvider, useToast } from "@/components/portal/ToastProvider";
import { SignInScreen } from "@/components/portal/screens/SignInScreen";
import { SignUpScreen } from "@/components/portal/screens/SignUpScreen";
import { EmployeeScreen } from "@/components/portal/screens/EmployeeScreen";
import { HrDashboard } from "@/components/portal/screens/HrDashboard";

function Splash(): ReactNode {
  return (
    <div className="splash" role="status" aria-busy="true">
      <div>
        <p className="splash-label">Checking your session…</p>
      </div>
    </div>
  );
}

function Portal(): ReactNode {
  const toast = useToast();
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<Me | null>(null);
  const [authView, setAuthView] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    let cancelled = false;
    const token = session.get();
    const boot: Promise<void> = token
      ? apiRequest<Me>("/api/auth/me", { token })
          .then((me) => {
            if (!cancelled) setUser(me);
          })
          .catch((caught: unknown) => {
            session.clear();
            if (!cancelled && caught instanceof ApiError && caught.status === 0) {
              toast("Cannot reach the server. Please try again shortly.", "error");
            }
          })
      : Promise.resolve();
    void boot.finally(() => {
      if (!cancelled) setBooting(false);
    });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    return onUnauthorized(() => {
      session.clear();
      setUser(null);
      toast("Your session expired. Please sign in again.", "info");
    });
  }, [toast]);

  const handleSignedIn = useCallback(
    (me: Me, welcomeMessage?: string): void => {
      setUser(me);
      toast(welcomeMessage ?? `Signed in as ${me.email}.`, "success");
    },
    [toast],
  );

  const handleSignOut = useCallback((): void => {
    session.clear();
    setUser(null);
    setAuthView("signin");
    toast("Signed out. Your token was cleared for this tab.", "info");
  }, [toast]);

  if (booting) {
    return <Splash />;
  }

  let screen: ReactNode;
  if (user === null) {
    screen =
      authView === "signin" ? (
        <SignInScreen onSignedIn={handleSignedIn} onSwitchToSignUp={() => setAuthView("signup")} />
      ) : (
        <SignUpScreen onSignedIn={handleSignedIn} onSwitchToSignIn={() => setAuthView("signin")} />
      );
  } else if (user.role === "HR") {
    screen = <HrDashboard token={session.get() ?? ""} />;
  } else {
    screen = <EmployeeScreen token={session.get() ?? ""} />;
  }

  return (
    <div className="app-shell">
      {user ? <TopBar user={user} onSignOut={handleSignOut} /> : null}
      <main className="app-main" id="main-content">
        {screen}
      </main>
      <footer className="app-footer">
        <span>
          Workplace pulse only · Individual answers stay private; HR sees team averages only.
        </span>
      </footer>
    </div>
  );
}

export default function Home(): ReactNode {
  return (
    <ToastProvider>
      <Portal />
    </ToastProvider>
  );
}
