"use client";

import type { ReactNode } from "react";

export function ScoreGauge({
  score,
  size = 148,
  caption,
}: {
  score: number | null;
  size?: number;
  caption?: string;
}): ReactNode {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = score === null ? 0 : Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - clamped / 100);
  const gradientId = `gauge-grad-${Math.round(size)}`;

  return (
    <figure className="gauge" style={{ margin: 0 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg
          className="gauge-ring"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={
            score === null
              ? "No score yet"
              : `Wellbeing score ${score.toFixed(1)} out of 100`
          }
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--c-lime)" />
              <stop offset="55%" stopColor="var(--c-green)" />
              <stop offset="100%" stopColor="var(--c-teal)" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(20, 61, 96, 0.1)"
            strokeWidth={12}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={12}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span className="gauge-value" style={{ color: "var(--c-navy)" }}>
            {score === null ? "—" : score.toFixed(1)}
          </span>
          <span className="gauge-unit">/ 100</span>
        </div>
      </div>
      {caption ? <figcaption className="gauge-caption">{caption}</figcaption> : null}
    </figure>
  );
}
