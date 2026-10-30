import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Btn, LoadState, Page, Reveal, Select, StatChip } from "@/components/kit";
import { Conditions, DEFAULT_SCENARIO } from "@/components/predict/Conditions";
import { Generation } from "@/components/predict/Generation";
import { Workspace } from "@/components/predict/Workspace";
import { fmtDate, useData, type FullModel, type IndexFile, type SeasonFile } from "@/lib/data";
import { decodeScenario, encodeScenario } from "@/lib/replay";
import { predictRace, type RaceFile, type Scenario } from "@/lib/simulator";

type Search = { year?: number; round?: number; grid?: string; chaos?: string; rel?: string; out?: string };

export const Route = createFileRoute("/predict")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    year: s.year ? Number(s.year) : undefined,
    round: s.round ? Number(s.round) : undefined,
    grid: typeof s.grid === "string" ? s.grid : undefined,
    chaos: s.chaos != null ? String(s.chaos) : undefined,
    rel: s.rel != null ? String(s.rel) : undefined,
    out: typeof s.out === "string" ? s.out : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Predict a Grand Prix — Lights Out" },
      { name: "description", content: "Set the race conditions, run 10,000 simulations and drag the starting grid." },
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
  if (ms <= 0) return <>Race day</>;
  const d = Math.floor(ms / 864e5);
  const h = Math.floor(ms / 36e5) % 24;
  const m = Math.floor(ms / 6e4) % 60;
  const s = Math.floor(ms / 1e3) % 60;
  return (
    <>
      {d}d {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </>
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
  const race = raceQ.data;
  const model = mdl.data;

  // A shared link opens straight into the workspace with its scenario.
  const shared = useMemo(() => decodeScenario(search), [search]);
  const [scenario, setScenario] = useState<Scenario>({
    ...DEFAULT_SCENARIO,
    ...(shared.chaos ? { chaos: shared.chaos } : {}),
    ...(shared.reliability ? { reliability: shared.reliability } : {}),
    ...(shared.retired ? { retired: shared.retired } : {}),
  });
  const [phase, setPhase] = useState<"ready" | "gen" | "done">(search.year ? "done" : "ready");
  const [order, setOrder] = useState<number[] | null>(shared.order ?? null);
  const [copied, setCopied] = useState(false);

  const gridOrder = useMemo(() => {
    if (!race) return [];
    const initial = [...race.entries].sort((a, b) => a.grid - b.grid).map((e) => e.driverId);
    return order && order.length === initial.length && order.every((id) => initial.includes(id)) ? order : initial;
  }, [race, order]);

  const result = useMemo(() => (race && model && phase === "gen" ? predictRace(model, race, gridOrder, scenario) : null), [race, model, phase, gridOrder, scenario]);

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
    setOrder(null);
    navigate({ search: { year, round } });
  };
  const share = async () => {
    const q = new URLSearchParams({ year: String(race.year), round: String(race.round), ...encodeScenario({ ...scenario, order: gridOrder }) });
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/predict?${q}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const status =
    race.status === "projected" ? "Grid projected from recent qualifying" : race.status === "qualifying" ? "Grid set by qualifying" : "Predicted out of sample";

  return (
    <Page>
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <Reveal>
          <p className="text-[14px] text-muted-foreground">
            {race.year} season, round {race.round}
          </p>
          <h1 className="display mt-3 text-[clamp(48px,7.6vw,128px)]">{race.name.replace(" Grand Prix", "")}</h1>
          <p className="mt-3 text-[16px] text-muted-foreground">
            {race.circuit.name}
            {race.circuit.location ? `, ${race.circuit.location}` : ""}
          </p>
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
                {r.round}. {r.name.replace(" Grand Prix", "")}
              </option>
            ))}
          </Select>
        </Reveal>
      </section>

      <Reveal i={2} className="mt-8 grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <StatChip value={race.status === "completed" ? fmtDate(race.date) : <Countdown date={race.date} />} label={race.status === "completed" ? "raced on" : "until lights out"} />
        <StatChip value={race.entries.length} label="cars on the grid" />
        <StatChip value={race.laps ?? "–"} label="laps" />
        <StatChip value={race.status === "completed" ? "Backtest" : race.status === "qualifying" ? "Set" : "Projected"} label={status} />
      </Reveal>

      <Reveal i={3} className="mt-10">
        <Conditions scenario={scenario} onChange={setScenario} entries={race.entries} />
      </Reveal>

      <AnimatePresence mode="wait">
        {phase === "ready" && (
          <motion.div key="ready" exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-4 py-14">
            <Btn onClick={() => setPhase("gen")} className="h-14 px-10 text-[16px]">
              Generate prediction
            </Btn>
            <p className="text-[14px] text-muted-foreground">10,000 races with these conditions, in your browser.</p>
          </motion.div>
        )}
        {phase === "gen" && result && (
          <motion.div key="gen" exit={{ opacity: 0 }} className="py-14">
            <Generation result={result} onDone={() => setPhase("done")} />
          </motion.div>
        )}
        {phase === "done" && (
          <motion.div key={`ws-${race.raceId}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-14">
            <div className="mb-10 flex flex-wrap gap-3">
              <Btn variant="ghost" onClick={() => setPhase("gen")} className="h-11 px-5 text-[14px]">
                Replay the reveal
              </Btn>
              <Btn variant="ghost" onClick={share} className="h-11 px-5 text-[14px]">
                {copied ? "Link copied" : "Copy link to this scenario"}
              </Btn>
            </div>
            <Workspace model={model} race={race} scenario={scenario} order={gridOrder} setOrder={setOrder} />
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
