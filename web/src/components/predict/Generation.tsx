import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Car3D } from "@/components/car/Car3D";
import { Btn, Stripe } from "@/components/kit";
import { pct } from "@/lib/data";
import type { DriverResult, SimulationResult } from "@/lib/simulator";
import { livery } from "@/lib/teams";

const DURATION = 3400;

/** Deterministic pseudo-noise so the bars "jostle" the same way on every run. */
function jitter(id: number, k: number) {
  const s = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The signature animation. The real result is already computed; the counter and
 * the bars converge on it so the user sees the simulation "settle".
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
      const v = Math.min(1, (now - t0) / DURATION);
      if (now - last > 240 || v === 1) {
        setT(v);
        last = now;
      }
      if (v < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const done = t >= 1;
  const ease = 1 - Math.pow(1 - t, 3);
  const bucket = Math.floor(t * 12);
  const rows = result.drivers
    .map((d) => ({ d, v: d.podium * ease + (1 - ease) * jitter(d.entry.driverId, bucket) * 0.9 }))
    .sort((a, b) => b.v - a.v);
  const races = Math.round(10000 * ease);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="display text-[clamp(56px,10vw,150px)] tnum" aria-live="polite">
          {races.toLocaleString("en-GB")}
          <span className="ml-3 text-[clamp(18px,2vw,26px)] font-normal tracking-normal text-muted-foreground">races run</span>
        </p>
        {!done && (
          <Btn variant="ghost" onClick={() => setT(1)}>
            Skip
          </Btn>
        )}
      </div>
      <div className="mt-4 h-px bg-border">
        <div className="h-px bg-primary" style={{ width: `${t * 100}%` }} />
      </div>

      <AnimatePresence mode="wait">
        {!done ? (
          <motion.div key="bars" exit={{ opacity: 0 }} className="mt-10 space-y-1.5">
            {rows.map(({ d, v }) => (
              <motion.div
                layout
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                key={d.entry.driverId}
                className="flex items-center gap-3 text-[14px] tnum"
              >
                <span className="w-10 font-semibold">{d.entry.code}</span>
                <div className="h-3 flex-1 bg-card">
                  <div className="h-3" style={{ width: `${Math.min(1, v) * 100}%`, background: livery(d.entry.team).primary }} />
                </div>
                <span className="w-12 text-right text-muted-foreground">{pct(v)}</span>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Podium key="podium" top={result.drivers.slice(0, 3)} onDone={onDone} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Podium({ top, onDone }: { top: DriverResult[]; onDone: () => void }) {
  const reduce = useReducedMotion();
  const order = [1, 0, 2];
  const heights = ["h-56", "h-40", "h-28"];
  const w = livery(top[0].entry.team);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8">
      <Car3D primary={w.primary} secondary={w.secondary} number={top[0].entry.number} className="mx-auto h-64 w-full max-w-2xl" />
      <div className="mx-auto grid max-w-3xl grid-cols-3 items-end gap-2 md:gap-4">
        {order.map((i, k) => {
          const d = top[i];
          return (
            <motion.div
              key={d.entry.driverId}
              initial={reduce ? false : { opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + k * 0.35, type: "spring", stiffness: 160, damping: 20 }}
            >
              <div className="mb-3 px-1">
                <p className="text-[14px] text-muted-foreground">{d.entry.team}</p>
                <p className="text-lg font-semibold leading-tight md:text-2xl">{d.entry.name}</p>
              </div>
              <div className={`${heights[i]} flex flex-col justify-between bg-raised p-3 md:p-4`}>
                <div className="flex items-center gap-2">
                  <Stripe team={d.entry.team} className="h-6" />
                  <span className="display text-2xl md:text-4xl">P{i + 1}</span>
                  <span className="ml-auto font-semibold">{d.entry.code}</span>
                </div>
                <dl className="tnum text-[14px] md:text-[16px]">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Podium</dt>
                    <dd className="font-semibold">{pct(d.podium)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Win</dt>
                    <dd>{pct(d.win)}</dd>
                  </div>
                </dl>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-10 flex justify-center">
        <Btn onClick={onDone}>Open the workspace</Btn>
      </div>
    </motion.div>
  );
}
