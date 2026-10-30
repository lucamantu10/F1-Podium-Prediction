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
import { predictRace, type DriverResult, type RaceFile } from "@/lib/simulator";
import { livery } from "@/lib/teams";
import { cn } from "@/lib/utils";

export function Workspace({ model, race }: { model: FullModel; race: RaceFile }) {
  const initial = useMemo(() => [...race.entries].sort((a, b) => a.grid - b.grid).map((e) => e.driverId), [race]);
  const [order, setOrder] = useState(initial);
  const moved = order.some((id, i) => id !== initial[i]);
  const base = useMemo(() => predictRace(model, race), [model, race]);
  const result = useMemo(() => (moved ? predictRace(model, race, order) : base), [model, race, order, moved, base]);
  const byId = useMemo(() => new Map(result.drivers.map((d) => [d.entry.driverId, d])), [result]);
  const baseById = useMemo(() => new Map(base.drivers.map((d) => [d.entry.driverId, d])), [base]);
  const [selected, setSelected] = useState(result.drivers[0].entry.driverId);
  const sel = byId.get(selected) ?? result.drivers[0];
  const completed = race.status === "completed";

  return (
    <div className="space-y-24">
      {completed && <AgainstResult result={base} />}
      <section className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <div className="flex items-end justify-between gap-4">
            <h2 className="display text-4xl md:text-5xl">Starting grid</h2>
            <Btn variant="ghost" onClick={() => setOrder(initial)} disabled={!moved} className="h-10 px-4 text-[15px]">
              Reset grid
            </Btn>
          </div>
          <p className="mt-3 text-muted-foreground">
            Drag a driver to another slot (or focus one and use space and the arrow keys). The race reruns instantly.
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
        <div className="space-y-16">
          <Tower drivers={result.drivers} completed={completed} selected={selected} onSelect={setSelected} />
          <DriverPanel d={sel} completed={completed} />
        </div>
      </section>
    </div>
  );
}

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
        <ol className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 pb-10" aria-label="Starting grid">
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
  return (
    // Even slots sit half a box back, like the staggered boxes painted on a grid.
    <li className={slot % 2 === 0 ? "translate-y-8" : ""}>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined }}
        {...attributes}
        {...listeners}
        onClick={() => onSelect(id)}
        aria-label={`Slot ${slot}, ${d.entry.name}, podium ${pct(d.podium)}`}
        className={cn(
          "flex cursor-grab touch-none items-center gap-2 border bg-card px-2.5 py-2.5 tnum transition-colors active:cursor-grabbing md:gap-3 md:px-3",
          top ? "border-primary" : "border-border hover:border-muted-foreground",
          selected && "bg-raised",
          isDragging && "bg-raised",
        )}
      >
        <span className="w-5 text-[14px] text-muted-foreground">{slot}</span>
        <Stripe team={d.entry.team} className="h-7" />
        <span className="font-semibold">{d.entry.code}</span>
        <span className="ml-auto text-right">
          <span className="block text-[15px]">{pct(d.podium)}</span>
          {pts !== 0 && (
            <span className={cn("block text-[12px]", pts > 0 ? "text-helps" : "text-hurts")}>
              {pts > 0 ? `▲ +${pts}` : `▼ ${pts}`} pts
            </span>
          )}
        </span>
      </div>
    </li>
  );
}

function Tower({
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
  return (
    <div>
      <h2 className="display text-4xl md:text-5xl">Timing tower</h2>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[15px]">
          <thead className="text-[13px] text-muted-foreground">
            <tr>
              <th className="py-2 font-normal">Driver</th>
              <th className="text-right font-normal">Grid</th>
              <th className="text-right font-normal">Win</th>
              <th className="pl-4 font-normal">Podium</th>
              <th className="text-right font-normal">Exp. finish</th>
              {completed && <th className="text-right font-normal">Finished</th>}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <motion.tr
                layout="position"
                key={d.entry.driverId}
                onClick={() => onSelect(d.entry.driverId)}
                className={cn("cursor-pointer border-t border-border hover:bg-raised", selected === d.entry.driverId && "bg-raised")}
              >
                <td className="py-2">
                  <button className="flex items-center gap-2 text-left" onClick={() => onSelect(d.entry.driverId)}>
                    <Stripe team={d.entry.team} />
                    <span className="font-semibold">{d.entry.code}</span>
                    <span className="hidden text-muted-foreground md:inline">{d.entry.name}</span>
                  </button>
                </td>
                <td className="text-right">{d.entry.grid}</td>
                <td className="text-right">{pct(d.win)}</td>
                <td className="pl-4">
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-right">{pct(d.podium)}</span>
                    <div className="h-1 w-24 bg-card">
                      <div className="h-1" style={{ width: `${d.podium * 100}%`, background: livery(d.entry.team).primary }} />
                    </div>
                  </div>
                </td>
                <td className="text-right">{d.expectedPosition.toFixed(1)}</td>
                {completed && <td className="text-right">{d.entry.finishPosition ?? (d.entry.status ? "DNF" : "–")}</td>}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DriverPanel({ d, completed }: { d: DriverResult; completed: boolean }) {
  const l = livery(d.entry.team);
  const fin = d.entry.finishPosition;
  return (
    <motion.div key={d.entry.driverId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground">{d.entry.team}</p>
          <h3 className="display text-4xl">{d.entry.name}</h3>
        </div>
        <Link to="/drivers/$id" params={{ id: String(d.entry.driverId) }} className="underline">
          Driver page
        </Link>
      </div>
      <dl className="mt-6 grid grid-cols-3 gap-4 tnum">
        {[
          ["Win", pct(d.win, 1)],
          ["Podium", pct(d.podium, 1)],
          ["Expected finish", d.expectedPosition.toFixed(1)],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[14px] text-muted-foreground">{k}</dt>
            <dd className="text-3xl font-semibold md:text-4xl">{v}</dd>
          </div>
        ))}
      </dl>
      <h4 className="mt-10 font-semibold">Chance of each finishing position</h4>
      {completed && fin && <p className="text-[14px] text-muted-foreground">Outlined: actual finish, P{fin}.</p>}
      <div className="mt-3">
        <ColumnChart
          labels={d.positions.map((_, i) => `${i + 1}`)}
          values={d.positions}
          color={(i) => (i < 3 ? l.primary : "var(--muted-foreground)")}
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
      <h4 className="mb-4 mt-10 font-semibold">What drives the prediction</h4>
      <Diverging items={d.explanation.map((e) => ({ label: e.label, value: e.impact }))} />
    </motion.div>
  );
}

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
    <section className="grid gap-8 border-y border-border py-8 md:grid-cols-[auto_1fr_1fr] md:items-center">
      <div>
        <p className="text-muted-foreground">Model against the result</p>
        <p className="display text-5xl tnum">{hits} of 3</p>
      </div>
      {rows.map(([t, list]) => (
        <div key={t}>
          <p className="mb-2 text-[14px] text-muted-foreground">{t}</p>
          <div className="flex gap-3">
            {list.map((d) => (
              <span
                key={d.entry.driverId}
                className={cn(
                  "flex items-center gap-2 border px-3 py-1.5 font-semibold",
                  actualIds.has(d.entry.driverId) && t === "Predicted podium" ? "border-primary" : "border-border",
                )}
              >
                <Stripe team={d.entry.team} />
                {d.entry.code}
              </span>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
