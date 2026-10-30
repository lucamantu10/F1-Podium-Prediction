import { motion } from "framer-motion";
import type { RaceEntry, Scenario } from "@/lib/simulator";
import { cn } from "@/lib/utils";

export const PRESETS: { id: string; label: string; scenario: Required<Pick<Scenario, "chaos" | "reliability">> }[] = [
  { id: "dry", label: "Dry", scenario: { chaos: 1, reliability: 0 } },
  { id: "mixed", label: "Mixed", scenario: { chaos: 1.35, reliability: 0.6 } },
  { id: "wet", label: "Wet", scenario: { chaos: 1.8, reliability: 1.2 } },
  { id: "safety-car", label: "Safety car", scenario: { chaos: 1.25, reliability: 0.3 } },
];

export const DEFAULT_SCENARIO: Scenario = { chaos: 1, reliability: 0, retired: [] };

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  hint: string;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[14px]">
        <span>{label}</span>
        <span className="stat text-foreground">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={format(value)}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--signal)] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
        style={{ background: `linear-gradient(90deg, var(--signal) ${fill}%, rgba(255,255,255,0.1) ${fill}%)` }}
      />
      <span className="mt-2 block text-[12px] text-dim">{hint}</span>
    </label>
  );
}

/** What-if knobs on top of the trained model: weather presets, luck, reliability, retirements. */
export function Conditions({
  scenario,
  onChange,
  entries,
}: {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
  entries: RaceEntry[];
}) {
  const chaos = scenario.chaos ?? 1;
  const reliability = scenario.reliability ?? 0;
  const retired = new Set(scenario.retired ?? []);
  const active = PRESETS.find((p) => p.scenario.chaos === chaos && p.scenario.reliability === reliability)?.id;
  const toggle = (id: number) => {
    const next = new Set(retired);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...scenario, retired: [...next] });
  };
  const sorted = [...entries].sort((a, b) => a.grid - b.grid);
  return (
    <section aria-labelledby="conditions-title" className="glass rounded-3xl p-5 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="conditions-title" className="display text-[28px]">
            Race conditions
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">What-if settings on top of the model. Dry with no extra retirements is the model as trained.</p>
        </div>
        <div role="radiogroup" aria-label="Weather preset" className="flex flex-wrap gap-1 rounded-full bg-white/5 p-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              role="radio"
              aria-checked={active === p.id}
              onClick={() => onChange({ ...scenario, ...p.scenario })}
              className={cn(
                "relative rounded-full px-4 py-2 text-[13px] transition-colors",
                active === p.id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active === p.id && <motion.span layoutId="preset-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-7 md:grid-cols-2">
        <Slider
          label="Race-day luck"
          value={chaos}
          min={0.5}
          max={3}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => onChange({ ...scenario, chaos: v })}
          hint="Below 1 the form book holds; above 1 anything can happen."
        />
        <Slider
          label="Extra retirements"
          value={reliability}
          min={0}
          max={3}
          step={0.1}
          format={(v) => (v === 0 ? "Off" : `${v.toFixed(1)}× recent DNF rate`)}
          onChange={(v) => onChange({ ...scenario, reliability: v })}
          hint="Each car fails in proportion to its own recent reliability."
        />
      </div>

      <div className="mt-7">
        <p className="text-[14px]">
          Retire a driver <span className="text-dim">({retired.size} out)</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sorted.map((e) => {
            const out = retired.has(e.driverId);
            return (
              <button
                key={e.driverId}
                onClick={() => toggle(e.driverId)}
                aria-pressed={out}
                className={cn(
                  "stat rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                  out ? "border-[var(--signal)] bg-[var(--signal)]/15 text-foreground line-through" : "border-border text-muted-foreground hover:border-white/30 hover:text-foreground",
                )}
              >
                {e.code}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
