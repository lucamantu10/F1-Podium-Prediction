"use client";

import { useState } from "react";
import { pct } from "@/lib/format";

type Bin = { predicted: number; observed: number; count: number };

const S = 320;
const PAD = 40;

/** Predicted podium chance against how often it actually happened. */
export function CalibrationChart({ bins }: { bins: Bin[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const scale = (v: number) => PAD + v * (S - PAD * 1.5);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="relative mx-auto max-w-sm">
      <svg
        viewBox={`0 0 ${S} ${S}`}
        className="w-full overflow-visible"
        role="img"
        aria-label={`Calibration: ${bins.map((b) => `predicted ${pct(b.predicted)}, happened ${pct(b.observed)}`).join("; ")}`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={scale(0)} x2={scale(1)} y1={S - scale(t)} y2={S - scale(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={scale(0) - 8} y={S - scale(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--ink-3)">
              {t * 100}%
            </text>
            <text x={scale(t)} y={S - scale(0) + 18} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
              {t * 100}%
            </text>
          </g>
        ))}
        <line x1={scale(0)} y1={S - scale(0)} x2={scale(1)} y2={S - scale(1)} stroke="var(--ink-3)" strokeWidth={1} />
        <text x={scale(0.62)} y={S - scale(0.7)} fontSize={11} fill="var(--ink-3)" transform={`rotate(-45 ${scale(0.62)} ${S - scale(0.7)})`}>
          perfect calibration
        </text>
        {bins.map((b, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <circle cx={scale(b.predicted)} cy={S - scale(b.observed)} r={14} fill="transparent" />
            <circle
              cx={scale(b.predicted)}
              cy={S - scale(b.observed)}
              r={hover === i ? 6 : 5}
              fill="var(--chart-model)"
              stroke="var(--asphalt)"
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-ink-3">
        <span>Up: how often it happened</span>
        <span>Right: what the model said</span>
      </figcaption>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-sm border border-line bg-asphalt-3 px-3 py-2 text-sm shadow-lg">
          <p className="tabular whitespace-nowrap">
            Said {pct(bins[hover].predicted)}, happened {pct(bins[hover].observed)}
          </p>
          <p className="tabular text-ink-3">{bins[hover].count.toLocaleString("en-GB")} driver entries</p>
        </div>
      )}
    </figure>
  );
}
