import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { LineChart } from "@/components/charts";
import { LoadState, Page, Reveal } from "@/components/kit";
import { pct, useData, type FullModel } from "@/lib/data";

export const Route = createFileRoute("/model")({
  head: () => ({
    meta: [
      { title: "How the model works — Lights Out" },
      {
        name: "description",
        content: "How Lights Out predicts Formula 1 podiums: earlier-race features, out-of-sample seasons, Plackett-Luce strengths and 10,000 simulated races.",
      },
    ],
  }),
  component: ModelPage,
});

function Calibration({ points }: { points: { predicted: number; observed: number; count: number }[] }) {
  const S = 320;
  const m = 36;
  const x = (v: number) => m + v * (S - m * 1.5);
  const y = (v: number) => S - m - v * (S - m * 1.5);
  const [h, setH] = useState<number | null>(null);
  return (
    <div className="relative max-w-md">
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full" role="img" aria-label="Calibration: predicted against observed podium rate">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={m - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">
              {pct(t)}
            </text>
            <text x={x(t)} y={S - m + 16} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
              {pct(t)}
            </text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
        <polyline fill="none" stroke="var(--primary)" strokeWidth="1.5" points={points.map((p) => `${x(p.predicted)},${y(p.observed)}`).join(" ")} />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(p.predicted)}
            cy={y(p.observed)}
            r={h === i ? 6 : 4}
            fill="var(--primary)"
            onMouseEnter={() => setH(i)}
            onMouseLeave={() => setH(null)}
          />
        ))}
        <text x={S / 2} y={S - 4} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
          Predicted
        </text>
      </svg>
      {h != null && (
        <div className="absolute right-0 top-0 border border-border bg-raised px-3 py-2 text-[13px] tnum">
          Predicted {pct(points[h].predicted, 1)}
          <br />
          Observed {pct(points[h].observed, 1)}
          <br />
          {points[h].count} driver-races
        </div>
      )}
    </div>
  );
}

function ModelPage() {
  const q = useData<FullModel>("model.json");
  const m = q.data;
  if (!m)
    return (
      <Page>
        <LoadState error={q.error} onRetry={() => q.refetch()} rows={6} />
      </Page>
    );
  const sim = m.models[m.selectedModel] ?? m.models.race_simulator;
  const years = Object.keys(sim.per_season).sort();
  const fi = [...m.featureImportance].sort((a, b) => b.importance - a.importance).slice(0, 10);
  const fmax = fi[0]?.importance || 1;
  return (
    <Page>
      <Reveal>
        <h1 className="display max-w-5xl text-[clamp(44px,7vw,104px)]">How the prediction is made</h1>
      </Reveal>
      <div className="mt-12 grid max-w-5xl gap-8 text-[18px] md:grid-cols-2">
        <Reveal i={1}>
          <p>
            Each driver is described by {m.features.length} numbers built only from earlier races: grid slot, qualifying gap, recent finishes, podium and
            retirement rates, team form and championship position. Nothing from the race itself leaks in.
          </p>
        </Reveal>
        <Reveal i={2}>
          <p>
            Every season since {m.backtestSeasons[0]} is predicted by a model trained only on the seasons before it. The model turns the numbers into a strength
            per driver (a Plackett-Luce ranking model), then runs 10,000 races with random luck and counts how often each driver finishes on the podium.
          </p>
        </Reveal>
        <Reveal i={3} className="md:col-span-2">
          <p className="text-muted-foreground">
            To be honest about it: the first three on the grid are a strong benchmark. Over {m.baseline.overall.races} races, simply copying the front row and
            P3 called {pct(m.baseline.overall.podium_hit_rate, 1)} of podium places; the model called {pct(sim.overall.podium_hit_rate, 1)}. Its real value is in
            the probabilities: how likely, not just who.
          </p>
        </Reveal>
      </div>

      <section className="mt-28">
        <Reveal>
          <h2 className="display text-4xl md:text-5xl">Podium places called, per season</h2>
        </Reveal>
        <Reveal i={1} className="mt-6">
          <LineChart
            labels={years}
            ariaLabel="Podium places called per season, model against the grid"
            left={{ min: 0.4, max: 0.9, ticks: [0.4, 0.5, 0.6, 0.7, 0.8, 0.9], format: (v) => pct(v) }}
            series={[
              { name: sim.label, color: "var(--primary)", values: years.map((y) => sim.per_season[y].podium_hit_rate) },
              {
                name: m.baseline.label,
                color: "var(--muted-foreground)",
                values: years.map((y) => m.baseline.per_season[y]?.podium_hit_rate ?? null),
                dashed: true,
              },
            ]}
            tooltip={(i) => (
              <>
                <b>{years[i]}</b>
                <br />
                Model {pct(sim.per_season[years[i]].podium_hit_rate, 1)}
                <br />
                Grid {pct(m.baseline.per_season[years[i]]?.podium_hit_rate, 1)}
              </>
            )}
          />
        </Reveal>
      </section>

      <section className="mt-28 grid gap-16 lg:grid-cols-2">
        <Reveal>
          <h2 className="display text-4xl">Calibration</h2>
          <p className="mb-6 mt-2 text-muted-foreground">
            When the model says 30%, does it happen about 30% of the time? Points on the dashed diagonal mean yes.
          </p>
          <Calibration points={sim.calibration} />
        </Reveal>
        <Reveal i={1}>
          <h2 className="display text-4xl">What matters most</h2>
          <p className="mb-6 mt-2 text-muted-foreground">The ten most important inputs.</p>
          <div className="space-y-3">
            {fi.map((f, i) => (
              <div key={f.feature}>
                <div className="mb-1 flex justify-between text-[15px]">
                  <span>{f.label}</span>
                  <span className="tnum text-muted-foreground">{f.importance.toFixed(3)}</span>
                </div>
                <div className="h-2 bg-card">
                  <motion.div
                    className="h-2 bg-foreground"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(Math.max(0, f.importance) / fmax) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.05 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="mt-28">
        <Reveal>
          <h2 className="display text-4xl md:text-5xl">Four models compared</h2>
        </Reveal>
        <Reveal i={1} className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[15px]">
            <thead className="text-[13px] text-muted-foreground">
              <tr>
                <th className="py-2 font-normal">Model</th>
                <th className="text-right font-normal">Podium places called</th>
                <th className="text-right font-normal">Top pick on podium</th>
                <th className="text-right font-normal">Full podium</th>
                <th className="text-right font-normal">ROC-AUC</th>
                <th className="text-right font-normal">Log loss</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(m.models).map(([k, v]) => (
                <tr key={k} className="border-t border-border">
                  <td className="py-3">
                    <span className={k === m.selectedModel ? "selected-line font-semibold" : ""}>{v.label}</span>
                  </td>
                  <td className="text-right">{pct(v.overall.podium_hit_rate, 1)}</td>
                  <td className="text-right">{pct(v.overall.top_pick_podium_rate, 1)}</td>
                  <td className="text-right">{pct(v.overall.full_podium_rate, 1)}</td>
                  <td className="text-right">{v.overall.roc_auc?.toFixed(3)}</td>
                  <td className="text-right">{v.overall.log_loss?.toFixed(3)}</td>
                </tr>
              ))}
              <tr className="border-t border-border text-muted-foreground">
                <td className="py-3">{m.baseline.label}</td>
                <td className="text-right">{pct(m.baseline.overall.podium_hit_rate, 1)}</td>
                <td className="text-right">{pct(m.baseline.overall.top_pick_podium_rate, 1)}</td>
                <td className="text-right">–</td>
                <td className="text-right">–</td>
                <td className="text-right">–</td>
              </tr>
            </tbody>
          </table>
        </Reveal>
      </section>
    </Page>
  );
}
