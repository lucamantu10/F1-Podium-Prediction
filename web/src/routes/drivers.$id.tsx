import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Car3D } from "@/components/car/Car3D";
import { ColumnChart, LineChart } from "@/components/charts";
import { CountUp, LoadState, Page, Reveal } from "@/components/kit";
import { pct, useData, type DriverFile } from "@/lib/data";
import { livery } from "@/lib/teams";

export const Route = createFileRoute("/drivers/$id")({
  head: () => ({
    meta: [
      { title: "Driver profile — Lights Out" },
      { name: "description", content: "Career figures, season-by-season results, form and model predictions for a Formula 1 driver." },
    ],
  }),
  component: DriverPage,
});

function age(dob: string | null) {
  if (!dob) return null;
  const b = new Date(dob);
  const n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
}

function DriverPage() {
  const { id } = Route.useParams();
  const q = useData<DriverFile>(`drivers/${id}.json`);
  const d = q.data;
  if (!d)
    return (
      <Page>
        <LoadState error={q.error} onRetry={() => q.refetch()} rows={6} />
      </Page>
    );
  const l = livery(d.currentTeam);
  const c = d.career;
  const recent = d.recentRaces.slice(-24);
  const tm = d.teammate;
  const form = d.form;
  const years = age(d.dateOfBirth);
  return (
    <Page>
      <title>{`${d.name} — Lights Out`}</title>
      <section className="relative grid gap-8 overflow-hidden border-b border-border pb-12 lg:grid-cols-2 lg:items-center">
        <motion.span
          aria-hidden
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="display pointer-events-none absolute -left-2 -top-6 select-none text-[clamp(200px,34vw,480px)] tnum"
          style={{ color: l.primary, opacity: 0.22 }}
        >
          {d.number ?? ""}
        </motion.span>
        <div className="relative pt-24 md:pt-40">
          <Reveal>
            <p className="text-muted-foreground">
              {d.currentTeam}, {d.nationality}
              {years != null && `, ${years} years old`}
            </p>
          </Reveal>
          <Reveal i={1}>
            <h1 className="display mt-3 text-[clamp(48px,7.5vw,120px)]">
              {d.forename}
              <br />
              {d.surname}
            </h1>
          </Reveal>
          {d.firstRace && (
            <Reveal i={2}>
              <p className="mt-4 text-muted-foreground">
                First race: {d.firstRace.race}, {d.firstRace.year}
              </p>
            </Reveal>
          )}
        </div>
        <Reveal i={2} className="relative">
          <Car3D primary={l.primary} secondary={l.secondary} number={d.number} className="h-72 w-full md:h-96" />
        </Reveal>
      </section>

      <section className="grid grid-cols-2 gap-x-6 gap-y-10 py-16 md:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Starts", c.starts],
            ["Wins", c.wins],
            ["Podiums", c.podiums],
            ["Poles", c.poles],
            ["Points", c.points],
            ["Best finish", c.bestFinish],
          ] as const
        ).map(([k, v], i) => (
          <Reveal key={k} i={i}>
            <p className="text-muted-foreground">{k}</p>
            <p className="display text-[clamp(44px,5vw,72px)]">
              {v == null ? (
                "–"
              ) : (
                <>
                  {k === "Best finish" && "P"}
                  <CountUp value={v} />
                </>
              )}
            </p>
          </Reveal>
        ))}
      </section>

      <section className="grid gap-16 lg:grid-cols-2">
        <Reveal>
          <h2 className="display text-4xl">Season by season</h2>
          <p className="mb-4 mt-2 text-muted-foreground">Points per season, championship position above each column.</p>
          <ColumnChart
            labels={d.seasons.map((s) => `'${String(s.year).slice(2)}`)}
            values={d.seasons.map((s) => s.points)}
            color={() => l.primary}
            top={(i) => (d.seasons[i].championshipPosition ? `P${d.seasons[i].championshipPosition}` : null)}
            ariaLabel="Points per season"
            tooltip={(i) => {
              const s = d.seasons[i];
              return (
                <>
                  <b>{s.year}</b>, {s.team}
                  <br />
                  {s.points} pts, {s.wins} wins, {s.podiums} podiums
                  <br />
                  Championship P{s.championshipPosition ?? "–"}
                </>
              );
            }}
          />
        </Reveal>
        <Reveal i={1}>
          <h2 className="display text-4xl">Last {recent.length} races</h2>
          <p className="mb-4 mt-2 text-muted-foreground">Finish position (P1 at the top) and the model's podium chance.</p>
          <LineChart
            labels={recent.map((r) => `${String(r.year).slice(2)}/${r.round}`)}
            ariaLabel="Recent finishes and predicted podium chance"
            left={{ min: 1, max: 20, invert: true, ticks: [1, 5, 10, 15, 20], format: (v) => `P${v}` }}
            right={{ min: 0, max: 1, ticks: [0, 0.5, 1], format: (v) => pct(v) }}
            series={[
              { name: "Finish position", color: l.primary, values: recent.map((r) => r.finishPosition) },
              {
                name: "Predicted podium chance",
                color: "var(--foreground)",
                values: recent.map((r) => r.predictedPodium),
                axis: "right",
                dashed: true,
              },
            ]}
            tooltip={(i) => {
              const r = recent[i];
              return (
                <>
                  <b>
                    {r.race} {r.year}
                  </b>
                  <br />
                  Grid {r.grid ?? "–"}, finish {r.finishPosition ? `P${r.finishPosition}` : r.status}
                  <br />
                  Podium chance {pct(r.predictedPodium)}
                </>
              );
            }}
          />
        </Reveal>
      </section>

      <section className="mt-24 grid gap-16 lg:grid-cols-3">
        {tm && (
          <Reveal>
            <h2 className="display text-4xl">Against {tm.name}</h2>
            <p className="mt-2 text-muted-foreground">
              {tm.year}, {tm.races} races together.
            </p>
            {(
              [
                ["Qualifying", tm.qualiAhead],
                ["Race", tm.raceAhead],
              ] as const
            ).map(([k, a]) => {
              const b = tm.races - a;
              return (
                <div key={k} className="mt-6">
                  <div className="mb-1 flex justify-between text-[14px] tnum">
                    <span>
                      {d.code} {a}
                    </span>
                    <span className="text-muted-foreground">{k}</span>
                    <span>
                      {b} {tm.name.split(" ").pop()}
                    </span>
                  </div>
                  <div className="flex h-3 bg-card">
                    <motion.div
                      className="h-3"
                      style={{ background: l.primary }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(a / Math.max(1, tm.races)) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9 }}
                    />
                    <div className="h-3 flex-1 bg-muted-foreground/40" />
                  </div>
                </div>
              );
            })}
          </Reveal>
        )}
        <Reveal i={1}>
          <h2 className="display text-4xl">Current form</h2>
          <dl className="mt-6 space-y-5 tnum">
            {[
              ["Average finish, last 5", form.drv_avg_finish_5 != null ? form.drv_avg_finish_5.toFixed(1) : "–"],
              ["Podium rate, last 10", pct(form.drv_podium_rate_10)],
              ["DNF rate, last 10", pct(form.drv_dnf_rate_10)],
              ["Positions gained, last 10", form.drv_positions_gained_10 != null ? form.drv_positions_gained_10.toFixed(1) : "–"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between border-b border-border pb-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-3xl font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
        <Reveal i={2}>
          <h2 className="display text-4xl">Best circuits</h2>
          <table className="mt-6 w-full text-left text-[15px]">
            <thead className="text-[13px] text-muted-foreground">
              <tr>
                <th className="py-2 font-normal">Race</th>
                <th className="text-right font-normal">Starts</th>
                <th className="text-right font-normal">Wins</th>
                <th className="text-right font-normal">Podiums</th>
                <th className="text-right font-normal">Best</th>
              </tr>
            </thead>
            <tbody>
              {d.circuits.slice(0, 8).map((r) => (
                <tr key={r.race} className="border-t border-border">
                  <td className="py-2">{r.race.replace(" Grand Prix", "")}</td>
                  <td className="text-right">{r.starts}</td>
                  <td className="text-right">{r.wins}</td>
                  <td className="text-right">{r.podiums}</td>
                  <td className="text-right">{r.best ? `P${r.best}` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>
      <p className="mt-20">
        <Link to="/drivers" className="underline">
          All drivers
        </Link>
      </p>
    </Page>
  );
}
