import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { CarSilhouette } from "@/components/car/CarSilhouette";
import { Btn } from "@/components/kit";
import { pct } from "@/lib/data";
import type { DriverResult, SimulationResult } from "@/lib/simulator";
import { livery } from "@/lib/teams";

const DURATION = 3600;
const ease = [0.16, 1, 0.3, 1] as const;

/** Deterministic pseudo-noise so the bars "jostle" the same way on every run. */
function jitter(id: number, k: number) {
  const s = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The signature animation. The real result is already computed; the counter and
 * the bars converge on it, then the podium rises.
 */
export function Generation({ result, onDone }: { result: SimulationResult; onDone: () => void }) {
  const reduce = useReducedMotion();
  const [t, setT] = useState(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const v = Math.min(1, Math.max(0, (now - t0) / DURATION));
      if (now - last > 200 || v === 1) {
        setT(v);
        last = now;
      }
      if (v < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const done = t >= 1;
  const e = 1 - Math.pow(1 - t, 3);
  const bucket = Math.floor(t * 14);
  const rows = result.drivers
    .map((d) => ({ d, v: d.podium * e + (1 - e) * jitter(d.entry.driverId, bucket) * 0.9 }))
    .sort((a, b) => b.v - a.v);

  return (
    <div>
      <AnimatePresence mode="wait">
        {!done ? (
          <motion.div key="sim" exit={{ opacity: 0, transition: { duration: 0.4 } }}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <p className="display stat text-[clamp(64px,11vw,168px)]" aria-live="polite">
                {Math.round(10000 * e).toLocaleString("en-GB")}
                <span className="ml-4 align-middle font-sans text-[clamp(16px,1.6vw,22px)] font-normal tracking-normal text-muted-foreground">races simulated</span>
              </p>
              <Btn variant="ghost" onClick={() => setT(1)}>
                Skip
              </Btn>
            </div>
            <div className="mt-4 h-px overflow-hidden rounded-full bg-white/10">
              <div className="h-px bg-[var(--signal)] shadow-[0_0_12px_var(--signal)]" style={{ width: `${t * 100}%` }} />
            </div>
            <div className="mt-10 grid gap-1.5">
              {rows.map(({ d, v }) => (
                <motion.div layout transition={{ type: "spring", stiffness: 360, damping: 34 }} key={d.entry.driverId} className="flex items-center gap-3 text-[13px]">
                  <span className="stat w-10 text-foreground">{d.entry.code}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-2 rounded-full" style={{ width: `${Math.min(1, v) * 100}%`, background: livery(d.entry.team).primary }} />
                  </div>
                  <span className="stat w-12 text-right text-muted-foreground">{pct(v)}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <Podium key="podium" top={result.drivers.slice(0, 3)} onDone={onDone} />
        )}
      </AnimatePresence>
    </div>
  );
}

const STEPS = [
  { place: 1, height: "h-64 md:h-80", delay: 0.9 },
  { place: 0, height: "h-80 md:h-[26rem]", delay: 1.4 },
  { place: 2, height: "h-52 md:h-64", delay: 0.4 },
];

export function Podium({ top, onDone }: { top: DriverResult[]; onDone?: () => void }) {
  const reduce = useReducedMotion();
  const winner = livery(top[0].entry.team);
  return (
    <motion.section aria-labelledby="podium-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative">
      <h2 id="podium-title" className="sr-only">
        Predicted podium
      </h2>
      {/* winner's car, lit in the team colour */}
      <motion.div
        initial={reduce ? false : { opacity: 0, x: "-20%" }}
        animate={{ opacity: 1, x: "0%" }}
        transition={{ duration: 1.8, delay: 1.6, ease }}
        className="relative mx-auto -mb-10 max-w-3xl"
      >
        <div aria-hidden className="absolute inset-x-[10%] top-[20%] h-[60%] rounded-[50%] blur-3xl" style={{ background: `${winner.primary}22` }} />
        <CarSilhouette accent={winner.primary} className="relative w-full" />
      </motion.div>

      <div className="relative mx-auto grid max-w-4xl grid-cols-3 items-end gap-2 md:gap-4">
        {STEPS.map(({ place, height, delay }) => {
          const d = top[place];
          const l = livery(d.entry.team);
          return (
            <motion.div
              key={d.entry.driverId}
              initial={reduce ? false : { opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay, ease }}
            >
              <div className="mb-4 px-1">
                <p className="text-[13px] text-muted-foreground">{d.entry.team}</p>
                <p className="display text-[clamp(18px,2.2vw,30px)] leading-tight">{d.entry.name}</p>
              </div>
              <div className={`glass relative flex ${height} flex-col justify-between overflow-hidden rounded-t-3xl p-4 md:p-6`}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: l.primary, boxShadow: `0 0 24px ${l.primary}` }} />
                {place === 0 && <span aria-hidden className="absolute inset-x-0 -bottom-10 h-24 rounded-[50%] bg-[var(--signal)]/25 blur-2xl" />}
                <div className="flex items-start justify-between">
                  <span className="display stat text-[clamp(48px,7vw,104px)] leading-none">P{place + 1}</span>
                  <span className="stat mt-2 text-[14px] text-muted-foreground">{d.entry.code}</span>
                </div>
                <dl className="relative grid gap-1 text-[13px] md:text-[14px]">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Podium</dt>
                    <dd className="stat">{pct(d.podium)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Win</dt>
                    <dd className="stat">{pct(d.win)}</dd>
                  </div>
                </dl>
              </div>
            </motion.div>
          );
        })}
      </div>
      {onDone && (
        <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4 }} className="mt-12 flex justify-center">
          <Btn onClick={onDone} className="h-14 px-9">
            Open the race workspace
          </Btn>
        </motion.div>
      )}
    </motion.section>
  );
}
