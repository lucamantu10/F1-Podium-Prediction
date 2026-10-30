import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Car3D } from "@/components/car/Car3D";
import { Btn, LogoMark, Portrait, Reveal, Stripe } from "@/components/kit";
import { useLights } from "@/components/useLights";
import { fmtDate, pct, useData, type DriverSummary, type FullModel, type IndexFile, type SeasonFile } from "@/lib/data";
import { predictRace, type RaceFile } from "@/lib/simulator";
import { livery } from "@/lib/teams";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lights Out — simulate the next Grand Prix" },
      {
        name: "description",
        content: "Simulate the next Formula 1 race 10,000 times and see who reaches the podium. Drag the grid, rerun the race.",
      },
    ],
  }),
  component: Intro,
});

/** The start gantry, set inline in the headline where a word would be. */
function Gantry({ lit }: { lit: number }) {
  return (
    <span aria-hidden className="mx-[0.12em] inline-flex h-[0.72em] items-center gap-[0.09em] rounded-full bg-ink px-[0.12em] align-baseline">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="block size-[0.48em] rounded-full transition-colors duration-75"
          style={{ background: i < lit ? "var(--signal)" : "var(--signal-off)" }}
        />
      ))}
    </span>
  );
}

function Intro() {
  const lights = useLights();
  const { data: index } = useData<IndexFile>("index.json");
  const start = () => {
    if (window.scrollY > 40) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(lights.run, 600);
    } else lights.run();
  };
  return (
    <div className="theme-intro min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center justify-between px-[28px]">
        <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <LogoMark className="h-4 w-16" lit={5} />
          Lights Out
        </Link>
        <nav className="flex gap-5 text-[15px] md:gap-8" aria-label="Main">
          <Link to="/drivers" className="hover:underline">
            Drivers
          </Link>
          <Link to="/seasons" className="hover:underline">
            Seasons
          </Link>
          <Link to="/model" className="hover:underline">
            How it works
          </Link>
        </nav>
      </header>

      <section className="flex min-h-[calc(100svh-4rem)] flex-col justify-center px-[28px] pb-16">
        <motion.h1
          aria-label="Lights out"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="display whitespace-nowrap text-[12.4vw]"
        >
          Lights
          <Gantry lit={lights.lit} />
          out
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
        >
          <p className="max-w-xl text-[19px]">Simulate the next Grand Prix 10,000 times and see who reaches the podium.</p>
          <Btn onClick={start} disabled={lights.running} className="h-14 px-8 text-[18px]">
            {lights.running ? "Wait for it" : "Start the lights"}
          </Btn>
        </motion.div>
      </section>

      <HowItWorks />
      <TypeDriver />
      <Record index={index} />
      <RestOfSeason index={index} />

      <section className="theme-inverse bg-background px-[28px] py-40 text-foreground">
        <Reveal>
          <h2 className="display text-[clamp(48px,9vw,140px)]">Your grid. Your race.</h2>
        </Reveal>
        <Reveal i={1}>
          <Btn onClick={start} disabled={lights.running} className="mt-12 h-14 px-8 text-[18px]">
            Generate my prediction
          </Btn>
        </Reveal>
      </section>

      <footer className="theme-yellow bg-background px-[28px] pb-12 pt-32 text-foreground">
        <a href="https://github.com/lucamantu10/F1-Podium-Prediction" className="display block text-[clamp(32px,7vw,110px)] hover:underline">
          github.com/lucamantu10
        </a>
        <div className="mt-16 flex flex-col gap-2 text-[15px] md:flex-row md:justify-between">
          <p>Race data from the Ergast archive and the Jolpica API.</p>
          <p>Predictions are model estimates, not betting advice.</p>
        </div>
      </footer>

      <AnimatePresence>
        {lights.cut && <motion.div className="fixed inset-0 z-50 bg-ink" initial={{ opacity: 1 }} exit={{ opacity: 0 }} />}
      </AnimatePresence>
    </div>
  );
}

const STAGES = [
  ["Read the grid", "where everyone starts."],
  ["Weigh the form", "of every driver and team."],
  ["Run 10,000 races", "with luck in every one."],
  ["Count the podiums", "and turn them into odds."],
];

function HowItWorks() {
  const [stage, setStage] = useState(0);
  const { data: index } = useData<IndexFile>("index.json");
  const latest = index?.latestRace;
  const { data: race } = useData<RaceFile>(latest ? `races/${latest.year}-${latest.round}.json` : null);
  const { data: model } = useData<FullModel>("model.json");
  const result = useMemo(() => (race && model ? predictRace(model, race) : null), [race, model]);
  const grid = race ? [...race.entries].sort((a, b) => a.grid - b.grid).slice(0, 6) : [];
  const fi = (n: string) => model?.features.findIndex((f) => f.name === n) ?? -1;
  const lead = grid[0];
  const reduce = useReducedMotion();
  const form: [string, number, (v: number) => string][] = [
    ["Avg finish, last 5", fi("drv_avg_finish_5"), (v) => v.toFixed(1)],
    ["Podium rate, last 10", fi("drv_podium_rate_10"), (v) => pct(v)],
    ["Team podium rate", fi("con_podium_rate_10"), (v) => pct(v)],
    ["Races started", fi("drv_experience"), (v) => String(v)],
  ];
  return (
    <section className="px-[28px] py-40">
      <Reveal>
        <h2 className="display text-[clamp(40px,6vw,88px)]">How it works</h2>
      </Reveal>
      <div className="mt-16 grid gap-12 md:grid-cols-2">
        <Reveal i={1}>
          <AnimatePresence mode="wait">
            <motion.p
              key={stage}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="display min-h-[2em] text-[clamp(36px,4.6vw,72px)]"
            >
              {STAGES[stage][0]}
              <br />
              <span className="text-muted-foreground">{STAGES[stage][1]}</span>
            </motion.p>
          </AnimatePresence>
          <label className="mt-12 block">
            <span className="sr-only">Stage</span>
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={stage}
              onChange={(e) => setStage(+e.target.value)}
              className="w-full accent-[var(--ink)]"
              aria-valuetext={STAGES[stage][0]}
            />
          </label>
          <div className="mt-3 grid grid-cols-4 text-[14px] text-muted-foreground">
            {STAGES.map((s, i) => (
              <button key={s[0]} onClick={() => setStage(i)} className={i === stage ? "text-left text-foreground" : "text-left"}>
                {s[0]}
              </button>
            ))}
          </div>
        </Reveal>
        <Reveal i={2} className="min-h-80 bg-card p-6 md:p-10">
          {!race || !model ? (
            <div className="skeleton h-64" />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={stage} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="mb-5 text-[14px] text-muted-foreground">
                  {race.name} {race.year}
                </p>
                {stage === 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {grid.map((e) => (
                      <div
                        key={e.driverId}
                        className={`flex items-center gap-3 border border-border bg-background px-3 py-2 tnum ${e.grid % 2 === 0 ? "translate-y-5" : ""}`}
                      >
                        <span className="w-5 text-muted-foreground">{e.grid}</span>
                        <Stripe team={e.team} />
                        <span className="font-semibold">{e.code}</span>
                      </div>
                    ))}
                  </div>
                )}
                {stage === 1 && lead && (
                  <div>
                    <p className="text-xl font-semibold">{lead.name}</p>
                    <dl className="mt-6 grid grid-cols-2 gap-6 tnum">
                      {form.map(([label, i, format]) => {
                        const v = lead.features[i];
                        return (
                          <div key={label}>
                            <dt className="text-[14px] text-muted-foreground">{label}</dt>
                            <dd className="text-4xl font-semibold">{v == null ? "–" : format(v)}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                )}
                {stage === 2 && <RaceCounter />}
                {stage === 3 && result && (
                  <div className="space-y-3">
                    {result.drivers.slice(0, 5).map((d) => (
                      <div key={d.entry.driverId} className="flex items-center gap-3 tnum">
                        <span className="w-10 font-semibold">{d.entry.code}</span>
                        <div className="h-3 flex-1 bg-background">
                          <motion.div
                            className="h-3"
                            style={{ background: livery(d.entry.team).primary }}
                            initial={{ width: 0 }}
                            animate={{ width: `${d.podium * 100}%` }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                        <span className="w-12 text-right">{pct(d.podium)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </Reveal>
      </div>
    </section>
  );
}

function RaceCounter() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / 1600);
      setN(Math.round(10000 * t * (2 - t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <p className="display text-[clamp(56px,8vw,120px)] tnum">
      {n.toLocaleString("en-GB")}
      <span className="block text-xl font-normal text-muted-foreground">races simulated</span>
    </p>
  );
}

const EXAMPLES = ["Lando Norris", "Charles Leclerc", "Lewis Hamilton"];

function TypeDriver() {
  const [q, setQ] = useState("Max Verstappen");
  const { data: drivers } = useData<DriverSummary[]>("drivers/index.json");
  const match = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!drivers || s.length < 2) return null;
    return (
      drivers.find((d) => d.name.toLowerCase() === s) ??
      drivers.find((d) => d.name.toLowerCase().includes(s) || d.code?.toLowerCase() === s) ??
      null
    );
  }, [q, drivers]);
  const l = livery(match?.team);
  return (
    <section className="px-[28px] py-40">
      <Reveal>
        <label htmlFor="driver-q" className="text-[17px] text-muted-foreground">
          Type a driver
        </label>
        <input
          id="driver-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="display mt-2 block w-full border-0 bg-transparent p-0 text-[clamp(44px,8vw,128px)] outline-none placeholder:text-muted-foreground focus-visible:outline-none"
        />
      </Reveal>
      <Reveal i={1} className="mt-6 flex flex-wrap gap-3">
        {EXAMPLES.map((e) => (
          <button key={e} onClick={() => setQ(e)} className="border border-border px-4 py-2 text-[15px] hover:border-foreground">
            {e}
          </button>
        ))}
      </Reveal>
      <div className="mt-14 grid min-h-80 gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center">
        <AnimatePresence mode="wait">
          {match ? (
            <motion.div key={match.driverId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-card p-8">
              <div className="flex items-center gap-4">
                <Portrait number={match.number} team={match.team} size={64} />
                <div>
                  <p className="text-2xl font-semibold">{match.name}</p>
                  <p className="text-muted-foreground">
                    {match.team}, {match.nationality}
                  </p>
                </div>
              </div>
              <dl className="mt-8 grid grid-cols-3 gap-4 tnum">
                {(
                  [
                    ["Starts", match.starts],
                    ["Wins", match.wins],
                    ["Podiums", match.podiums],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[14px] text-muted-foreground">{k}</dt>
                    <dd className="text-4xl font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <Link to="/drivers/$id" params={{ id: String(match.driverId) }} className="mt-8 inline-block underline">
                Open driver page
              </Link>
            </motion.div>
          ) : (
            <p key="none" className="text-muted-foreground">
              {drivers ? "No driver matches that name yet." : "Loading drivers…"}
            </p>
          )}
        </AnimatePresence>
        <Car3D primary={l.primary} secondary={l.secondary} number={match?.number} className="h-80 w-full md:h-96" />
      </div>
    </section>
  );
}

function Figure({ int, frac, caption }: { int: string; frac?: string; caption: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-6 border-t border-border py-5">
      <span className="display text-right text-[clamp(48px,7vw,104px)] tnum">{int}</span>
      <span className="display w-[3.2ch] text-[clamp(48px,7vw,104px)] tnum">{frac ?? ""}</span>
      <span className="text-[17px] text-muted-foreground">{caption}</span>
    </div>
  );
}

function Record({ index }: { index?: IndexFile }) {
  const h = index?.headline;
  const split = (v: number) => {
    const [a, b] = (v * 100).toFixed(1).split(".");
    return [a, `.${b}%`];
  };
  return (
    <section className="grid gap-12 px-[28px] py-40 md:grid-cols-[1fr_2fr]">
      <Reveal>
        <h2 className="display text-[clamp(40px,5vw,76px)]">Tested on every race since 2014</h2>
      </Reveal>
      <div>
        {!h ? (
          <div className="skeleton h-96" />
        ) : (
          <>
            <Reveal i={1}>
              <Figure int={split(h.podiumHitRate)[0]} frac={split(h.podiumHitRate)[1]} caption="of podium places called" />
            </Reveal>
            <Reveal i={2}>
              <Figure int={split(h.topPickPodiumRate)[0]} frac={split(h.topPickPodiumRate)[1]} caption="of races with the top pick on the podium" />
            </Reveal>
            <Reveal i={3}>
              <Figure int={String(h.racesBacktested)} caption="races predicted out of sample" />
            </Reveal>
            <Reveal i={4}>
              <Figure int="10,000" caption="simulations per race" />
            </Reveal>
            <Reveal i={5}>
              <Figure int="0" frac={`.${h.rocAuc.toFixed(3).split(".")[1]}`} caption="ROC-AUC on podium finishes" />
            </Reveal>
          </>
        )}
      </div>
    </section>
  );
}

function RestOfSeason({ index }: { index?: IndexFile }) {
  const year = index?.nextRace?.year ?? index?.latestRace.year;
  const { data } = useData<SeasonFile>(year ? `seasons/${year}.json` : null);
  const rest = data?.races.filter((r) => r.status !== "completed") ?? [];
  return (
    <section className="grid gap-12 px-[28px] py-40 md:grid-cols-[1fr_2fr]">
      <Reveal>
        <h2 className="display text-[clamp(40px,5vw,76px)]">The rest of the season</h2>
      </Reveal>
      <Reveal i={1}>
        {!data ? (
          <div className="skeleton h-80" />
        ) : rest.length === 0 ? (
          <p>The season is complete.</p>
        ) : (
          <table className="w-full text-left text-[17px]">
            <thead className="text-[14px] text-muted-foreground">
              <tr>
                <th className="py-2 font-normal">Round</th>
                <th className="font-normal">Race</th>
                <th className="text-right font-normal">Date</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((r) => {
                const next = index?.nextRace?.round === r.round;
                return (
                  <tr key={r.round} className="border-t border-border">
                    <td className="py-4 tnum">{r.round}</td>
                    <td className={next ? "font-semibold" : ""}>
                      {r.name}
                      {next && <span className="ml-3 bg-primary px-2 py-0.5 text-[13px] text-primary-foreground">Next</span>}
                    </td>
                    <td className="text-right tnum">{fmtDate(r.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Reveal>
    </section>
  );
}
