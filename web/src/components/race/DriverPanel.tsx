"use client";

import { useState } from "react";
import type { DriverPrediction } from "@/lib/api";
import { pct } from "@/lib/format";
import { teamColor } from "@/lib/teams";

export function DriverPanel({ driver }: { driver: DriverPrediction }) {
  return (
    <section aria-labelledby="driver-panel-title" className="rounded-sm bg-asphalt-2 p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 h-10 w-1.5 shrink-0 rounded-full"
          style={{ background: teamColor(driver.team) }}
        />
        <div className="min-w-0">
          <h2 id="driver-panel-title" className="type-wide text-xl font-extrabold leading-tight">
            {driver.name}
          </h2>
          <p className="text-sm text-ink-2">
            {driver.team}, starting P{driver.grid}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-line py-4">
        <Figure label="Win" value={pct(driver.win_probability)} />
        <Figure label="Podium" value={pct(driver.probability)} />
        <Figure
          label="Expected finish"
          value={driver.expected_position ? `P${driver.expected_position.toFixed(1)}` : "–"}
        />
      </dl>

      {driver.position_probabilities && (
        <PositionChart probabilities={driver.position_probabilities} actual={driver.finish_position} />
      )}
      {driver.explanation && driver.explanation.length > 0 && (
        <WhyChart contributions={driver.explanation} />
      )}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-2xl font-bold">{value}</dd>
    </div>
  );
}

/** Probability of each finishing position, from 10,000 simulated races. */
function PositionChart({ probabilities, actual }: { probabilities: number[]; actual: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...probabilities, 0.01);
  const shown = hover ?? probabilities.indexOf(max);

  return (
    <figure className="mt-5">
      <figcaption className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">Where they finish in 10,000 simulations</span>
        <span className="tabular text-ink-2" aria-live="polite">
          P{shown + 1}: {pct(probabilities[shown], 1)}
        </span>
      </figcaption>
      <div className="relative mt-3">
        {/* Podium zone */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-sm bg-paint/[0.04]"
          style={{ width: `${(3 / probabilities.length) * 100}%` }}
        />
        <div
          className="relative flex h-28 items-end gap-0.5"
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label={probabilities
            .map((p, i) => `P${i + 1} ${pct(p, 1)}`)
            .slice(0, 10)
            .join(", ")}
        >
          {probabilities.map((p, i) => (
            <div
              key={i}
              className="flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(i)}
            >
              <div
                className="w-full rounded-t-[3px]"
                style={{
                  height: `${Math.max((p / max) * 100, p > 0 ? 2 : 0)}%`,
                  background: "var(--chart-model)",
                  opacity: hover === null || hover === i ? 1 : 0.45,
                  outline: actual === i + 1 ? "2px solid var(--paint)" : undefined,
                  outlineOffset: 1,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-ink-3 tabular">
        <span>P1</span>
        <span>Podium places are shaded{actual ? `; outlined bar is the actual finish` : ""}</span>
        <span>P{probabilities.length}</span>
      </div>
    </figure>
  );
}

/** The features pushing this driver's strength above or below the field average. */
function WhyChart({ contributions }: { contributions: NonNullable<DriverPrediction["explanation"]> }) {
  const max = Math.max(...contributions.map((c) => Math.abs(c.impact)), 0.01);
  return (
    <figure className="mt-6">
      <figcaption className="text-sm font-semibold">What drives the prediction</figcaption>
      <div className="mt-1 flex justify-between text-xs text-ink-3">
        <span>Hurts</span>
        <span>Helps</span>
      </div>
      <ul className="mt-2 space-y-2.5">
        {contributions.map((c) => {
          const width = (Math.abs(c.impact) / max) * 50;
          const helps = c.impact > 0;
          return (
            <li key={c.feature} className="text-sm">
              <span className="text-ink-2">
                {c.label}
                <span className="sr-only">{helps ? ", helps" : ", hurts"}</span>
              </span>
              <div className="relative mt-1 h-2">
                <span aria-hidden className="absolute inset-y-[-3px] left-1/2 w-px bg-line" />
                <span
                  className="absolute inset-y-0 rounded-[3px]"
                  style={{
                    width: `${width}%`,
                    left: helps ? "50%" : `${50 - width}%`,
                    background: helps ? "var(--chart-up)" : "var(--chart-down)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
