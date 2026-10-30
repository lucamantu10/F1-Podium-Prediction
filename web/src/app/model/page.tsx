import type { Metadata } from "next";
import { Suspense } from "react";
import { CalibrationChart } from "@/components/charts/CalibrationChart";
import { SeasonChart } from "@/components/charts/SeasonChart";
import { api, type ModelMetrics } from "@/lib/api";
import { pct } from "@/lib/format";

export const metadata: Metadata = { title: "How it works" };

export default function ModelPage() {
  return (
    <>
      <header className="pt-10 sm:pt-14">
        <h1 className="type-wide text-[clamp(2.25rem,6vw,4.5rem)] font-black leading-none tracking-tight">
          How it works
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">
          Before a race the model knows the grid, the qualifying gaps, and how every driver and team
          has been going. It turns that into a strength for each driver, then runs the race 10,000
          times. Counting how often each driver lands in each position gives the win, podium and
          finishing chances you see on every race page.
        </p>
      </header>
      <Suspense fallback={<div className="mt-12 h-[40rem] animate-pulse rounded-sm bg-asphalt-2" />}>
        <ModelReport />
      </Suspense>
    </>
  );
}

async function ModelReport() {
  const metrics = await api.model();
  const primary = metrics.models[metrics.selected_model];
  const seasons = metrics.backtest_seasons;
  const first = seasons[0];
  const last = seasons[seasons.length - 1];

  return (
    <div className="mt-14 space-y-20">
      <section aria-labelledby="score-title" className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 id="score-title" className="type-wide text-2xl font-extrabold">
            How often it gets it right
          </h2>
          <p className="mt-6 text-6xl font-bold">{pct(primary.overall.top_pick_podium_rate)}</p>
          <p className="mt-2 max-w-sm text-ink-2">
            of {primary.overall.races} races from {first} to {last}, the model&apos;s top pick finished
            on the podium. Each season was predicted by a model that had never seen it.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-line pt-6">
            <div>
              <dt className="text-sm text-ink-3">Podium places called</dt>
              <dd className="mt-1 text-2xl font-bold">{pct(primary.overall.podium_hit_rate, 1)}</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">First three on the grid</dt>
              <dd className="mt-1 text-2xl font-bold">
                {pct(metrics.baseline.overall.podium_hit_rate, 1)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="lg:col-span-7">
          <SeasonChart
            seasons={seasons}
            series={[
              {
                label: "Model",
                color: "var(--chart-model)",
                values: seasons.map((s) => primary.per_season[String(s)]?.podium_hit_rate ?? null),
              },
              {
                label: "Grid order",
                color: "var(--chart-grid)",
                values: seasons.map((s) => metrics.baseline.per_season[String(s)]?.podium_hit_rate ?? null),
              },
            ]}
          />
          <p className="mt-4 text-sm leading-relaxed text-ink-2">
            Starting position is the strongest single signal in Formula 1, so the first three on the
            grid is a hard benchmark to beat on raw picks. The two trade places season to season.
            Where the model earns its keep is in saying how likely each outcome is.
          </p>
        </div>
      </section>

      <section aria-labelledby="calibration-title" className="grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <h2 id="calibration-title" className="type-wide text-2xl font-extrabold">
            When it says 30%, it means 30%
          </h2>
          <p className="mt-4 text-ink-2">
            Group every prediction by the chance the model gave, then check how often those drivers
            really made the podium. Points close to the diagonal mean the percentages can be taken at
            face value.
          </p>
        </div>
        <div className="lg:col-span-7">
          <CalibrationChart bins={primary.calibration} />
        </div>
      </section>

      <section aria-labelledby="features-title" className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 id="features-title" className="type-wide text-2xl font-extrabold">
            What it pays attention to
          </h2>
          <p className="mt-4 text-ink-2">
            Shuffle one input at a time and measure how much worse the predictions get. Grid and
            qualifying lead, followed by how the team and driver have been performing lately.
          </p>
        </div>
        <Importance metrics={metrics} />
      </section>

      <section aria-labelledby="models-title">
        <h2 id="models-title" className="type-wide text-2xl font-extrabold">
          Models compared
        </h2>
        <p className="mt-4 max-w-2xl text-ink-2">
          Four approaches were tested the same way. The race simulator is used on the site because it
          scores as well as the best classifier and is the only one that produces win and finishing
          position chances that add up across the whole field.
        </p>
        <ModelTable metrics={metrics} />
      </section>

      <section aria-labelledby="honest-title" className="max-w-2xl">
        <h2 id="honest-title" className="type-wide text-2xl font-extrabold">
          No peeking at the result
        </h2>
        <ul className="mt-5 space-y-4 text-ink-2">
          <li>
            Form, track record and championship standings are worked out only from races that came
            before, in calendar order.
          </li>
          <li>
            Each season from {first} is predicted by a model trained on the seasons before it, then
            scored against what happened. Race pages for those seasons show those predictions.
          </li>
          <li>
            Crashes, safety cars, strategy and weather are not known before the start, which is why
            even a 90% favourite misses the podium sometimes.
          </li>
        </ul>
        <p className="mt-6 text-sm text-ink-3">
          Trained on {metrics.train_start_year} to {metrics.trained_through.slice(0, 4)}, last race
          included {metrics.trained_through}.
        </p>
      </section>
    </div>
  );
}

function Importance({ metrics }: { metrics: ModelMetrics }) {
  const top = metrics.feature_importance.slice(0, 10);
  const max = Math.max(...top.map((f) => f.importance), 1e-9);
  const descriptions = new Map(metrics.features.map((f) => [f.name, f.description]));
  return (
    <figure className="lg:col-span-7">
      <figcaption className="text-sm text-ink-3">Relative importance, top ten inputs</figcaption>
      <ul className="mt-4 space-y-3">
        {top.map((f) => (
          <li key={f.feature} className="grid grid-cols-[minmax(8rem,12rem)_1fr] items-center gap-4 text-sm">
            <span title={descriptions.get(f.feature)} className="text-ink-2">
              {f.label}
            </span>
            <span className="h-3">
              <span
                className="block h-full rounded-r-[3px]"
                style={{
                  width: `${Math.max((f.importance / max) * 100, 1)}%`,
                  background: "var(--chart-model)",
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function ModelTable({ metrics }: { metrics: ModelMetrics }) {
  const rows = Object.entries(metrics.models);
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="tabular w-full min-w-[36rem] text-left text-sm">
        <thead className="text-xs text-ink-3">
          <tr className="border-b border-line">
            <th scope="col" className="py-2 font-medium">Model</th>
            <th scope="col" className="py-2 text-right font-medium">Podium places called</th>
            <th scope="col" className="py-2 text-right font-medium">Top pick on podium</th>
            <th scope="col" className="py-2 text-right font-medium">Log loss (lower is better)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, m]) => (
            <tr key={name} className="border-b border-line/60">
              <th scope="row" className="py-3 font-semibold">
                {m.label}
                {name === metrics.selected_model && (
                  <span className="ml-2 text-xs font-normal text-purple">used on this site</span>
                )}
              </th>
              <td className="py-3 text-right">{pct(m.overall.podium_hit_rate, 1)}</td>
              <td className="py-3 text-right">{pct(m.overall.top_pick_podium_rate, 1)}</td>
              <td className="py-3 text-right">{m.overall.log_loss.toFixed(4)}</td>
            </tr>
          ))}
          <tr className="text-ink-2">
            <th scope="row" className="py-3 font-normal">{metrics.baseline.label}</th>
            <td className="py-3 text-right">{pct(metrics.baseline.overall.podium_hit_rate, 1)}</td>
            <td className="py-3 text-right">{pct(metrics.baseline.overall.top_pick_podium_rate, 1)}</td>
            <td className="py-3 text-right">–</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
