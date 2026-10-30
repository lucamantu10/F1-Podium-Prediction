import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { ColumnChart, Diverging } from "@/components/charts";
import { Btn, Stripe } from "@/components/kit";
import { pct, type FullModel } from "@/lib/data";
import { predictRace, type DriverResult, type RaceFile, type Scenario } from "@/lib/simulator";
import { livery } from "@/lib/teams";
import { cn } from "@/lib/utils";

type Metric = "podium" | "win";

export function Workspace({
  model,
  race,
  scenario,
  order,
  setOrder,
}: {
  model: FullModel;
  race: RaceFile;
  scenario: Scenario;
  order: number[];
  setOrder: (o: number[]) => void;
}) {
  const initial = useMemo(() => [...race.entries].sort((a, b) => a.grid - b.grid).map((e) => e.driverId), [race]);
  const moved = order.some((id, i) => id !== initial[i]);
  const base = useMemo(() => predictRace(model, race, undefined, scenario), [model, race, scenario]);
  const result = useMemo(() => (moved ? predictRace(model, race, order, scenario) : base), [model, race, order, moved, base, scenario]);
  const byId = useMemo(() => new Map(result.drivers.map((d) => [d.entry.driverId, d])), [result]);
  const baseById = useMemo(() => new Map(base.drivers.map((d) => [d.entry.driverId, d])), [base]);
  const [selected, setSelected] = useState(result.drivers[0].entry.driverId);
  const sel = byId.get(selected) ?? result.drivers[0];
  const completed = race.status === "completed";

  return (
    <div className="space-y-20">
      {completed && <AgainstResult result={base} />}
      <Results drivers={result.drivers} completed={completed} selected={selected} onSelect={setSelected} />
      <section className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <div className="flex items-end justify-between gap-4">
            <h2 className="display text-[clamp(32px,3.4vw,48px)]">Starting grid</h2>
            <Btn variant="ghost" onClick={() => setOrder(initial)} disabled={!moved} className="h-10 px-5 text-[14px]">
              Reset grid
            </Btn>
          </div>
          <p className="mt-3 text-[14px] text-muted-foreground">
            Drag a car to another slot, or focus one and use space and the arrow keys. Moving a car to the back is a pit-lane start. The race reruns instantly.
          </p>
          <Grid
            order={order}
            setOrder={setOrder}
            byId={byId}
            baseById={baseById}
            moved={moved}
            topId={result.drivers[0].entry.driverId}
            onSelect={setSelected}
            selected={selected}
          />
        </div>
        <DriverPanel d={sel} completed={completed} />
      </section>
    </div>
  );
}

/* ---------- Results with a podium / win toggle ---------- */
function Results({
  drivers,
  completed,
  selected,
  onSelect,
}: {
  drivers: DriverResult[];
  completed: boolean;
  selected: number;
  onSelect: (id: number) => void;
}) {
  const [metric, setMetric] = useState<Metric>("podium");
  const sorted = useMemo(() => [...drivers].sort((a, b) => b[metric] - a[metric]), [drivers, metric]);
  const max = Math.max(...sorted.map((d) => d[metric]), 0.01);
  return (
    <section aria-labelledby="results-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="results-title" className="display text-[clamp(32px,3.4vw,48px)]">
          Every driver
        </h2>
        <div role="radiogroup" aria-label="Show probability of" className="glass flex rounded-full p-1">
          {(["podium", "win"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={metric === m}
              onClick={() => setMetric(m)}
              className={cn("relative rounded-full px-5 py-2 text-[14px]", metric === m ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {metric === m && <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">{m === "podium" ? "P(podium)" : "P(win)"}</span>
            </button>
          ))}
        </div>
      </div>
      <ol className="glass mt-6 divide-y divide-white/[0.06] overflow-hidden rounded-3xl">
        {sorted.map((d, i) => {
          const l = livery(d.entry.team);
          const v = d[metric];
          return (
            <motion.li layout="position" key={d.entry.driverId} transition={{ type: "spring", stiffness: 300, damping: 34 }}>
              <button
                onClick={() => onSelect(d.entry.driverId)}
                aria-pressed={selected === d.entry.driverId}
                className={cn(
                  "grid w-full grid-cols-[2rem_auto_1fr_4rem] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] md:grid-cols-[2.5rem_14rem_1fr_5rem_5rem_5rem] md:px-6",
                  selected === d.entry.driverId && "bg-white/[0.06]",
                )}
              >
                <span className="stat text-[13px] text-dim">{i + 1}</span>
                <span className="flex items-center gap-3">
                  <Stripe team={d.entry.team} className="h-6" />
                  <span className="stat font-medium">{d.entry.code}</span>
                  <span className="hidden truncate text-[14px] text-muted-foreground md:inline">{d.entry.name}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ background: l.primary }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(v / max) * 100}%` }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  />
                </span>
                <span className="stat text-right text-[15px]">{pct(v, 1)}</span>
                <span className="stat hidden text-right text-[13px] text-muted-foreground md:block">P{d.expectedPosition.toFixed(1)}</span>
                <span className="stat hidden text-right text-[13px] text-muted-foreground md:block">
                  {completed ? (d.entry.finishPosition ? `P${d.entry.finishPosition}` : "DNF") : d.dnf > 0 ? `${pct(d.dnf)} DNF` : `Grid ${d.entry.grid}`}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>
      <p className="mt-3 text-[12px] text-dim">
        Columns: chance, expected finish, {completed ? "actual finish" : "grid slot or retirement chance"}.
      </p>
    </section>
  );
}

/* ---------- Staggered starting grid ---------- */
function Grid({
  order,
  setOrder,
  byId,
  baseById,
  moved,
  topId,
  onSelect,
  selected,
}: {
  order: number[];
  setOrder: (o: number[]) => void;
  byId: Map<number, DriverResult>;
  baseById: Map<number, DriverResult>;
  moved: boolean;
  topId: number;
  onSelect: (id: number) => void;
  selected: number;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setOrder(arrayMove(order, order.indexOf(Number(e.active.id)), order.indexOf(Number(e.over.id))));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <ol className="mt-8 grid grid-cols-2 gap-x-3 gap-y-2.5 pb-10 md:gap-x-4" aria-label="Starting grid">
          {order.map((id, i) => (
            <Slot
              key={id}
              id={id}
              slot={i + 1}
              d={byId.get(id)!}
              delta={moved ? byId.get(id)!.podium - baseById.get(id)!.podium : 0}
              top={id === topId}
              onSelect={onSelect}
              selected={selected === id}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function Slot({
  id,
  slot,
  d,
  delta,
  top,
  onSelect,
  selected,
}: {
  id: number;
  slot: number;
  d: DriverResult;
  delta: number;
  top: boolean;
  onSelect: (id: number) => void;
  selected: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const pts = Math.round(delta * 100);
  const out = d.dnf >= 1;
  return (
    // Even slots sit half a box back, like the staggered boxes painted on a grid.
    <li className={slot % 2 === 0 ? "translate-y-7" : ""}>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
        {...attributes}
        {...listeners}
        onClick={() => onSelect(id)}
        aria-label={`Slot ${slot}, ${d.entry.name}, podium ${pct(d.podium)}`}
        className={cn(
          "glass flex cursor-grab touch-none items-center gap-2 rounded-2xl px-3 py-2.5 transition-colors active:cursor-grabbing md:gap-3",
          top && "border-[var(--signal)]/70 shadow-[0_0_24px_rgba(255,43,34,0.18)]",
          selected && "bg-white/[0.09]",
          isDragging && "bg-white/[0.12]",
          out && "opacity-45",
        )}
      >
        <span className="stat w-5 text-[12px] text-dim">{slot}</span>
        <Stripe team={d.entry.team} className="h-7" />
        <span className={cn("stat font-medium", out && "line-through")}>{d.entry.code}</span>
        <span className="ml-auto text-right">
          <span className="stat block text-[14px]">{pct(d.podium)}</span>
          {pts !== 0 && (
            <span className={cn("stat block text-[11px]", pts > 0 ? "text-foreground" : "text-[var(--signal)]")}>
              {pts > 0 ? `▲ +${pts}` : `▼ ${pts}`}
            </span>
          )}
        </span>
      </div>
    </li>
  );
}

/* ---------- Selected driver ---------- */
function DriverPanel({ d, completed }: { d: DriverResult; completed: boolean }) {
  const l = livery(d.entry.team);
  const fin = d.entry.finishPosition;
  return (
    <motion.div key={d.entry.driverId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass relative self-start overflow-hidden rounded-3xl p-6 md:p-8">
      <span aria-hidden className="absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: `${l.primary}26` }} />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted-foreground">{d.entry.team}</p>
          <h3 className="display text-[clamp(30px,3vw,44px)]">{d.entry.name}</h3>
        </div>
        <Link to="/drivers/$id" params={{ id: String(d.entry.driverId) }} className="glass rounded-full px-4 py-2 text-[13px] hover:bg-white/10">
          Driver page
        </Link>
      </div>
      <dl className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Win", pct(d.win, 1)],
          ["Podium", pct(d.podium, 1)],
          ["Expected", `P${d.expectedPosition.toFixed(1)}`],
          ["Retires", pct(d.dnf, 0)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-white/[0.04] px-4 py-3">
            <dt className="text-[12px] text-muted-foreground">{k}</dt>
            <dd className="stat mt-1 text-[24px]">{v}</dd>
          </div>
        ))}
      </dl>
      <h4 className="relative mt-8 text-[14px] font-medium">Chance of each finishing position</h4>
      {completed && fin && <p className="text-[12px] text-dim">Outlined: actual finish, P{fin}.</p>}
      <div className="relative mt-3">
        <ColumnChart
          labels={d.positions.map((_, i) => `${i + 1}`)}
          values={d.positions}
          color={(i) => (i < 3 ? l.primary : "rgba(255,255,255,0.28)")}
          outline={completed && fin ? fin - 1 : null}
          yFormat={(v) => pct(v)}
          ariaLabel={`Finishing position probabilities for ${d.entry.name}`}
          tooltip={(i) => (
            <>
              <b>P{i + 1}</b>
              <br />
              {pct(d.positions[i], 1)} of races
            </>
          )}
        />
      </div>
      <h4 className="relative mb-4 mt-8 text-[14px] font-medium">What drives the prediction</h4>
      <Diverging items={d.explanation.map((e) => ({ label: e.label, value: e.impact }))} />
    </motion.div>
  );
}

/* ---------- Model against the result ---------- */
function AgainstResult({ result }: { result: { drivers: DriverResult[] } }) {
  const predicted = result.drivers.slice(0, 3);
  const actual = [...result.drivers]
    .filter((d) => d.entry.finishPosition && d.entry.finishPosition <= 3)
    .sort((a, b) => a.entry.finishPosition! - b.entry.finishPosition!);
  const actualIds = new Set(actual.map((a) => a.entry.driverId));
  const hits = predicted.filter((p) => actualIds.has(p.entry.driverId)).length;
  const rows: [string, DriverResult[]][] = [
    ["Predicted podium", predicted],
    ["Actual podium", actual],
  ];
  return (
    <section className="glass grid gap-6 rounded-3xl p-6 md:grid-cols-[auto_1fr_1fr] md:items-center md:p-8">
      <div>
        <p className="text-[13px] text-muted-foreground">Model against the result</p>
        <p className="display stat text-[56px]">{hits}/3</p>
      </div>
      {rows.map(([t, list]) => (
        <div key={t}>
          <p className="mb-2 text-[12px] text-muted-foreground">{t}</p>
          <div className="flex flex-wrap gap-2">
            {list.map((d) => (
              <span
                key={d.entry.driverId}
                className={cn(
                  "stat flex items-center gap-2 rounded-full border px-3 py-1.5 text-[14px]",
                  actualIds.has(d.entry.driverId) && t === "Predicted podium" ? "border-white/40 bg-white/10" : "border-border",
                )}
              >
                <Stripe team={d.entry.team} className="h-4" />
                {d.entry.code}
              </span>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
