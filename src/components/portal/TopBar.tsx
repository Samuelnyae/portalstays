"use client";

import type { Me } from "@/lib/portal/types";

export function TopBar({ user, onSignOut }: { user: Me; onSignOut: () => void }) {
  return (
    <header className="app-main-header">
      <nav className="topbar" aria-label="Signed-in session">
        <div className="brand">
          <img className="brand-logo" src="/logo.svg" alt="" width="38" height="38" />
          <span className="brand-name">
            PortalStays
            <span className="brand-sub">employee check-ins &amp; HR aggregates</span>
          </span>
        </div>
        <div className="topbar-user">
          <span className="user-email" title={user.email}>
            {user.email}
          </span>
          <span className={`chip ${user.role === "HR" ? "chip--navy" : "chip--teal"}`}>
            {user.role === "HR" ? "HR" : "Employee"}
          </span>
          <button type="button" className="btn btn--ghost btn--small" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </nav>
    </header>
  );
}
