import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { LoadState, Page, Portrait, Reveal, Stripe } from "@/components/kit";
import { useData, type DriverSummary } from "@/lib/data";

export const Route = createFileRoute("/drivers/")({
  head: () => ({
    meta: [
      { title: "Drivers — Lights Out" },
      { name: "description", content: "Every Formula 1 driver since 2014 with starts, wins and podiums." },
    ],
  }),
  component: Drivers,
});

function Drivers() {
  const q = useData<DriverSummary[]>("drivers/index.json");
  const [s, setS] = useState("");
  const reduce = useReducedMotion();
  const list = useMemo(() => {
    const t = s.trim().toLowerCase();
    return (q.data ?? []).filter(
      (d) => !t || d.name.toLowerCase().includes(t) || d.code?.toLowerCase().includes(t) || d.team?.toLowerCase().includes(t),
    );
  }, [q.data, s]);
  return (
    <Page>
      <Reveal>
        <h1 className="display text-[clamp(44px,7vw,104px)]">Drivers</h1>
      </Reveal>
      <Reveal i={1}>
        <label className="mt-8 block max-w-md">
          <span className="sr-only">Search drivers</span>
          <input
            value={s}
            onChange={(e) => setS(e.target.value)}
            placeholder="Search by name, code or team"
            className="h-12 w-full border border-border bg-card px-4 text-[17px] placeholder:text-muted-foreground"
          />
        </label>
      </Reveal>
      <div className="mt-10">
        {!q.data ? (
          <LoadState error={q.error} onRetry={() => q.refetch()} rows={8} />
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {list.map((d, i) => (
              <motion.li
                key={d.driverId}
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 20) * 0.03 }}
              >
                <Link
                  to="/drivers/$id"
                  params={{ id: String(d.driverId) }}
                  className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 py-3 transition-colors hover:bg-raised active:bg-card md:grid-cols-[auto_2fr_2fr_repeat(3,5rem)] md:px-2"
                >
                  <Portrait number={d.number} team={d.team} />
                  <span>
                    <span className="block font-semibold group-hover:underline">{d.name}</span>
                    <span className="text-[14px] text-muted-foreground md:hidden">{d.team}</span>
                  </span>
                  <span className="hidden items-center gap-2 text-muted-foreground md:flex">
                    <Stripe team={d.team} />
                    {d.team}
                    {!d.active && `, last raced ${d.lastSeason}`}
                  </span>
                  {(
                    [
                      ["Starts", d.starts],
                      ["Wins", d.wins],
                      ["Podiums", d.podiums],
                    ] as const
                  ).map(([k, v], j) => (
                    <span key={k} className={`text-right tnum ${j < 2 ? "hidden md:block" : ""}`}>
                      <span className="block text-[12px] text-muted-foreground">{k}</span>
                      {v}
                    </span>
                  ))}
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
        {q.data && list.length === 0 && <p className="text-muted-foreground">No driver matches “{s}”.</p>}
      </div>
    </Page>
  );
}
