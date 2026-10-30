import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Btn, LoadState, Page, Reveal, Select } from "@/components/kit";
import { Generation } from "@/components/predict/Generation";
import { Workspace } from "@/components/predict/Workspace";
import { fmtDate, useData, type FullModel, type IndexFile, type SeasonFile } from "@/lib/data";
import { predictRace, type RaceFile } from "@/lib/simulator";

type Search = { year?: number; round?: number };

export const Route = createFileRoute("/predict")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    year: s.year ? Number(s.year) : undefined,
    round: s.round ? Number(s.round) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Predict a Grand Prix — Lights Out" },
      { name: "description", content: "Run 10,000 simulations of a Formula 1 race, then drag the starting grid and rerun it." },
    ],
  }),
  component: Predict,
});

function Countdown({ date }: { date: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(date + "T13:00:00Z").getTime() - now;
  if (ms <= 0) return <span>Race day has passed</span>;
  const d = Math.floor(ms / 864e5);
  const h = Math.floor(ms / 36e5) % 24;
  const m = Math.floor(ms / 6e4) % 60;
  const s = Math.floor(ms / 1e3) % 60;
  return (
    <span className="tnum">
      {d}d {String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
    </span>
  );
}

function Predict() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/predict" });
  const idx = useData<IndexFile>("index.json");
  const mdl = useData<FullModel>("model.json");
  const index = idx.data;
  const ref = index ? (search.year && search.round ? { year: search.year, round: search.round } : (index.nextRace ?? index.latestRace)) : null;
  const raceQ = useData<RaceFile>(ref ? `races/${ref.year}-${ref.round}.json` : null);
  const seasonQ = useData<SeasonFile>(ref ? `seasons/${ref.year}.json` : null);
  // Coming from a season calendar opens straight into the workspace.
  const [phase, setPhase] = useState<"ready" | "gen" | "done">(search.year ? "done" : "ready");
  const race = raceQ.data;
  const model = mdl.data;
  const result = useMemo(() => (race && model && phase === "gen" ? predictRace(model, race) : null), [race, model, phase]);

  const err = idx.error || mdl.error || raceQ.error;
  if (err)
    return (
      <Page>
        <LoadState
          error={err}
          onRetry={() => {
            idx.refetch();
            mdl.refetch();
            raceQ.refetch();
          }}
        />
      </Page>
    );
  if (!index || !model || !race || !ref)
    return (
      <Page>
        <LoadState rows={6} />
      </Page>
    );

  const pickable = seasonQ.data?.races.filter((r) => r.status !== "scheduled") ?? [];
  const setRace = (year: number, round: number) => {
    setPhase("ready");
    navigate({ search: { year, round } });
  };

  return (
    <Page>
      <section className="grid gap-10 border-b border-border pb-12 lg:grid-cols-[1fr_auto] lg:items-end">
        <Reveal>
          <p className="text-muted-foreground">
            {race.year}, round {race.round}, {fmtDate(race.date)}
          </p>
          <h1 className="display mt-3 text-[clamp(44px,7vw,112px)]">{race.name}</h1>
          <p className="mt-4 text-[19px]">
            {race.circuit.name}
            {race.circuit.location ? `, ${race.circuit.location}` : ""}
            {race.circuit.country ? `, ${race.circuit.country}` : ""}
          </p>
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-[16px]">
            {race.status !== "completed" && (
              <div>
                <dt className="text-muted-foreground">Lights out in</dt>
                <dd className="text-2xl font-semibold">
                  <Countdown date={race.date} />
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Grid</dt>
              <dd>
                {race.status === "projected"
                  ? "Grid projected from the last three qualifying sessions"
                  : race.status === "qualifying"
                    ? "Grid set by qualifying"
                    : "Race completed. Predicted out of sample, by a model that never saw this season."}
              </dd>
            </div>
          </dl>
        </Reveal>
        <Reveal i={1} className="flex flex-wrap items-end gap-3">
          <Select label="Season" value={ref.year} onChange={(v) => setRace(+v, 1)}>
            {[...index.seasons].reverse().map((s) => (
              <option key={s.year} value={s.year}>
                {s.year}
              </option>
            ))}
          </Select>
          <Select label="Round" value={ref.round} onChange={(v) => setRace(ref.year, +v)}>
            {pickable.map((r) => (
              <option key={r.round} value={r.round}>
                {r.round}. {r.name.replace(" Grand Prix", " GP")}
              </option>
            ))}
          </Select>
        </Reveal>
      </section>

      <AnimatePresence mode="wait">
        {phase === "ready" && (
          <motion.div key="ready" exit={{ opacity: 0 }} className="py-20">
            <Btn onClick={() => setPhase("gen")} className="h-16 px-10 text-[19px]">
              Generate prediction
            </Btn>
          </motion.div>
        )}
        {phase === "gen" && result && (
          <motion.div key="gen" exit={{ opacity: 0 }} className="py-12">
            <Generation result={result} onDone={() => setPhase("done")} />
          </motion.div>
        )}
        {phase === "done" && (
          <motion.div key={`ws-${race.raceId}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-12">
            <Workspace model={model} race={race} />
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
