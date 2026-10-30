"use client";

import { useMemo, useRef, useState } from "react";
import { api, type DriverPrediction, type RacePrediction } from "@/lib/api";
import { pct } from "@/lib/format";
import { teamColor } from "@/lib/teams";
import { DriverPanel } from "./DriverPanel";
import { StartingGrid } from "./StartingGrid";
import { TimingTower } from "./TimingTower";

const byGrid = (p: RacePrediction) =>
  [...p.leaderboard].sort((a, b) => a.grid - b.grid).map((d) => d.driver_id);

export function RaceView({ initial }: { initial: RacePrediction }) {
  const [prediction, setPrediction] = useState(initial);
  const [order, setOrder] = useState(() => byGrid(initial));
  const [selectedId, setSelectedId] = useState(initial.leaderboard[0].driver_id);
  const [status, setStatus] = useState<"idle" | "simulating" | "error">("idle");
  const requestId = useRef(0);

  const { year, round } = initial.race;
  const completed = initial.race.status === "completed";
  const baselineOrder = useMemo(() => byGrid(initial), [initial]);
  const isScenario = order.some((id, i) => id !== baselineOrder[i]);

  const drivers = useMemo(
    () => new Map(prediction.leaderboard.map((d) => [d.driver_id, d])),
    [prediction],
  );
  const baseline = useMemo(
    () => new Map(initial.leaderboard.map((d) => [d.driver_id, d])),
    [initial],
  );
  const topPick = prediction.leaderboard[0];
  const selected = drivers.get(selectedId) ?? topPick;

  async function reorder(next: number[]) {
    setOrder(next);
    if (next.every((id, i) => id === baselineOrder[i])) {
      setPrediction(initial);
      setStatus("idle");
      return;
    }
    const id = ++requestId.current;
    setStatus("simulating");
    try {
      // The API applies moves in order, so sending every slot ascending
      // reproduces this exact grid.
      const grid = Object.fromEntries(next.map((driverId, i) => [driverId, i + 1]));
      const result = await api.scenario(year, round, grid);
      if (id === requestId.current) {
        setPrediction(result);
        setStatus("idle");
      }
    } catch {
      if (id === requestId.current) setStatus("error");
    }
  }

  return (
    <div className="mt-10 space-y-12">
      {completed && initial.evaluation && <ResultComparison prediction={initial} />}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <section aria-labelledby="grid-title" className="min-w-0 lg:col-span-7">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="grid-title" className="type-wide text-2xl font-extrabold">
                Starting grid
              </h2>
              <p className="mt-1 max-w-prose text-sm text-ink-2">
                Drag a driver to another grid slot and the race is simulated again from that grid.
                The number on each box is the chance of finishing on the podium.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm" aria-live="polite">
              {status === "simulating" && <span className="text-ink-2">Simulating 10,000 races</span>}
              {status === "error" && (
                <span className="text-red">Simulation failed. Check that the API is running.</span>
              )}
              {isScenario && (
                <button
                  type="button"
                  onClick={() => reorder(baselineOrder)}
                  className="rounded-sm border border-line px-3 py-1.5 hover:bg-asphalt-2"
                >
                  Reset grid
                </button>
              )}
            </div>
          </div>
          <StartingGrid
            order={order}
            drivers={drivers}
            baseline={baseline}
            topPickId={topPick.driver_id}
            selectedId={selected.driver_id}
            editable
            showResult={completed && !isScenario}
            onSelect={setSelectedId}
            onReorder={reorder}
          />
          <p className="mt-6 flex items-center gap-2 text-xs text-ink-3">
            <span aria-hidden className="inline-block h-3 w-3 rounded-[2px] ring-2 ring-purple" />
            Purple marks the model&apos;s top pick, the way purple marks the fastest time on a timing
            screen.
          </p>
        </section>

        <div className="min-w-0 space-y-8 lg:sticky lg:top-6 lg:col-span-5 lg:self-start">
          <PodiumForecast
            drivers={prediction.leaderboard.slice(0, 3)}
            isScenario={isScenario}
            onSelect={setSelectedId}
          />
          <DriverPanel driver={selected} />
        </div>
      </div>

      <section aria-labelledby="tower-title">
        <h2 id="tower-title" className="type-wide mb-4 text-2xl font-extrabold">
          Whole field
        </h2>
        <TimingTower
          drivers={prediction.leaderboard}
          topPickId={topPick.driver_id}
          selectedId={selected.driver_id}
          showResult={completed && !isScenario}
          onSelect={setSelectedId}
        />
      </section>
    </div>
  );
}

function PodiumForecast({
  drivers,
  isScenario,
  onSelect,
}: {
  drivers: DriverPrediction[];
  isScenario: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <section aria-labelledby="forecast-title">
      <h2 id="forecast-title" className="type-wide text-2xl font-extrabold">
        {isScenario ? "Podium with your grid" : "Most likely podium"}
      </h2>
      <ol className="mt-4 divide-y divide-line border-y border-line">
        {drivers.map((d, i) => (
          <li key={d.driver_id}>
            <button
              type="button"
              onClick={() => onSelect(d.driver_id)}
              className="flex w-full items-center gap-4 py-3 text-left hover:bg-asphalt-2"
            >
              <span className="type-condensed w-6 text-center text-lg font-semibold text-ink-3">
                {i + 1}
              </span>
              <span aria-hidden className="h-8 w-1 rounded-full" style={{ background: teamColor(d.team) }} />
              <span className="min-w-0 flex-1">
                <span className="type-wide block truncate text-lg font-bold leading-tight">{d.name}</span>
                <span className="block text-xs text-ink-2">
                  {pct(d.win_probability)} to win
                </span>
              </span>
              <span className="text-right">
                <span className="block text-2xl font-bold leading-none">{pct(d.probability)}</span>
                <span className="text-xs text-ink-3">podium</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ResultComparison({ prediction }: { prediction: RacePrediction }) {
  const evaluation = prediction.evaluation!;
  const actual = new Set(evaluation.actual_podium);
  const hits = evaluation.podium_hits;
  return (
    <section
      aria-labelledby="result-title"
      className="grid gap-6 rounded-sm bg-asphalt-2 p-5 sm:grid-cols-[auto_1fr_1fr] sm:items-center sm:gap-10"
    >
      <div>
        <h2 id="result-title" className="text-sm text-ink-2">
          Model against the result
        </h2>
        <p className="type-wide mt-1 text-3xl font-extrabold">
          {hits} of 3 called
        </p>
      </div>
      <PodiumRow label="Predicted podium" codes={evaluation.predicted_podium} hit={(c) => actual.has(c)} />
      <PodiumRow label="Actual podium" codes={evaluation.actual_podium} hit={() => true} />
    </section>
  );
}

function PodiumRow({ label, codes, hit }: { label: string; codes: string[]; hit: (c: string) => boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <ol className="mt-1.5 flex gap-2">
        {codes.map((code) => (
          <li
            key={code}
            className={`type-wide rounded-sm px-2.5 py-1 text-base font-bold ${
              hit(code) ? "bg-asphalt-3 text-paint" : "text-ink-3 line-through decoration-ink-3"
            }`}
          >
            {code}
          </li>
        ))}
      </ol>
    </div>
  );
}
