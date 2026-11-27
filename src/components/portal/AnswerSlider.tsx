"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import type { Question } from "@/lib/portal/questions";

export function AnswerSlider({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: number | null;
  onChange: (value: number) => void;
}): ReactNode {
  const id = useId();
  const shown = value ?? 0;
  const pct = (shown / 10) * 100;

  return (
    <div className="question-card" style={{ "--question-accent": question.accent } as React.CSSProperties}>
      <div className="question-head">
        <span className="question-label" id={`${id}-label`}>
          <span className="question-dot" aria-hidden="true" />
          {question.label}
        </span>
        <span className="question-value" aria-hidden="true">
          {value === null ? "not answered" : `${value} / 10`}
        </span>
      </div>
      <p className="question-help" id={`${id}-help`}>
        {question.help}
      </p>
      <input
        id={id}
        className="range"
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
        type="range"
        min={0}
        max={10}
        step={1}
        value={shown}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-help`}
        aria-valuetext={value === null ? "not answered" : `${value} out of 10`}
      />
      <div className="range-ticks" aria-hidden="true">
        {Array.from({ length: 11 }, (_, tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div className="range-scale" aria-hidden="true">
        <span>not at all</span>
        <span>completely</span>
      </div>
    </div>
  );
}
