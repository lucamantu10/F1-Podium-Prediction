"use client";

import { useState } from "react";
import { pct } from "@/lib/format";

type Series = { label: string; color: string; values: (number | null)[] };

const W = 720;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 36, left: 52 };

/** Share of podium places called per season, one line per series.
 *  The lines converge, so identity comes from the legend and tooltip, not end labels. */
export function SeasonChart({ seasons, series }: { seasons: number[]; series: Series[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  const lo = Math.floor(Math.min(...all) * 10) / 10;
  const hi = Math.ceil(Math.max(...all) * 10) / 10;
  const ticks = Array.from({ length: Math.round((hi - lo) * 20) + 1 }, (_, i) => lo + i * 0.05);

  const x = (i: number) =>
    PAD.left + (i / Math.max(seasons.length - 1, 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const step = (W - PAD.left - PAD.right) / Math.max(seasons.length - 1, 1);

  return (
    <figure>
      <ul className="mb-3 flex flex-wrap gap-5 text-sm text-ink-2">
        {series.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full overflow-visible"
          role="img"
          aria-label="Podium places called per season by the model and by grid order"
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={14} fill="var(--ink-3)">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {seasons.map((season, i) => (
            <text
              key={season}
              x={x(i)}
              y={H - 10}
              textAnchor="middle"
              fontSize={14}
              fill={hover === i ? "var(--paint)" : "var(--ink-3)"}
              className={i % 2 && seasons.length > 8 ? "max-sm:hidden" : ""}
            >
              {season}
            </text>
          ))}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--ink-3)" strokeWidth={1} />
          )}
          {series.map((s) => {
            const points = s.values
              .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
              .filter(Boolean)
              .join(" ");
            return (
              <g key={s.label}>
                <polyline points={points} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {s.values.map((v, i) =>
                  v == null ? null : (
                    <circle
                      key={i}
                      cx={x(i)}
                      cy={y(v)}
                      r={hover === i ? 5 : 4}
                      fill={s.color}
                      stroke="var(--asphalt)"
                      strokeWidth={2}
                    />
                  ),
                )}
              </g>
            );
          })}
          {seasons.map((season, i) => (
            <rect
              key={season}
              x={x(i) - step / 2}
              y={PAD.top}
              width={step}
              height={H - PAD.top - PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-sm border border-line bg-asphalt-3 px-3 py-2 text-sm shadow-lg"
            style={{
              left: `${(x(hover) / W) * 100}%`,
              transform: hover > seasons.length / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            }}
          >
            <p className="font-semibold">{seasons[hover]}</p>
            {series.map((s) => (
              <p key={s.label} className="tabular flex items-center gap-2 whitespace-nowrap text-ink-2">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}: <span className="text-paint">{pct(s.values[hover], 1)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
