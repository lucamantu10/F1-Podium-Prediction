"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId } from "react";
import type { DriverPrediction } from "@/lib/api";
import { pct, points } from "@/lib/format";
import { teamColor } from "@/lib/teams";

type Props = {
  order: number[];
  drivers: Map<number, DriverPrediction>;
  baseline: Map<number, DriverPrediction>;
  topPickId: number;
  selectedId: number;
  editable: boolean;
  showResult: boolean;
  onSelect: (id: number) => void;
  onReorder: (order: number[]) => void;
};

export function StartingGrid({
  order,
  drivers,
  baseline,
  topPickId,
  selectedId,
  editable,
  showResult,
  onSelect,
  onReorder,
}: Props) {
  // A stable id keeps dnd-kit's aria attributes identical on server and client.
  const dndId = useId();
  const sensors = useSensors(
    // A short drag threshold keeps a plain click as "select".
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(Number(active.id));
    const to = order.indexOf(Number(over.id));
    onReorder(arrayMove(order, from, to));
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Press space to pick up this driver, use the arrow keys to move them on the grid, and press space again to drop.",
        },
      }}
    >
      <SortableContext items={order} strategy={rectSortingStrategy} disabled={!editable}>
        <ol className="grid grid-cols-2 gap-x-3 gap-y-2 sm:gap-x-6" aria-label="Starting grid">
          {order.map((id, index) => {
            const driver = drivers.get(id);
            if (!driver) return null;
            return (
              <GridSlot
                key={id}
                slot={index + 1}
                driver={driver}
                before={baseline.get(id)}
                isTopPick={id === topPickId}
                isSelected={id === selectedId}
                editable={editable}
                showResult={showResult}
                onSelect={() => onSelect(id)}
              />
            );
          })}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function GridSlot({
  slot,
  driver,
  before,
  isTopPick,
  isSelected,
  editable,
  showResult,
  onSelect,
}: {
  slot: number;
  driver: DriverPrediction;
  before?: DriverPrediction;
  isTopPick: boolean;
  isSelected: boolean;
  editable: boolean;
  showResult: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: driver.driver_id,
  });
  const delta = before ? driver.probability - before.probability : 0;
  const moved = before && before.grid !== driver.grid;
  const livery = teamColor(driver.team);
  const onPodium = driver.finish_position != null && driver.finish_position <= 3;

  return (
    <li
      ref={setNodeRef}
      // Even slots sit half a box back, like the staggered boxes painted on a grid.
      className={`relative ${slot % 2 === 0 ? "mt-9 sm:mt-11" : ""} ${isDragging ? "z-10" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {/* Painted grid box: a bracket open towards the back of the grid. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-1.5 h-4 border-x-2 border-t-2 border-paint/45"
      />
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-label={`Grid ${slot}, ${driver.name}, ${driver.team}. Podium chance ${pct(driver.probability)}.`}
        className={`group relative flex w-full flex-col gap-1.5 overflow-hidden rounded-sm bg-asphalt-2 py-2.5 pl-4 pr-3 text-left transition-colors hover:bg-asphalt-3 ${
          editable ? "cursor-grab active:cursor-grabbing" : ""
        } ${isDragging ? "shadow-[0_12px_32px_rgba(0,0,0,0.45)] bg-asphalt-3" : ""} ${
          isTopPick ? "ring-2 ring-purple" : isSelected ? "ring-2 ring-paint/70" : ""
        }`}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: livery }} />
        <span className="flex items-baseline justify-between gap-2">
          <span className="flex items-baseline gap-2.5">
            <span className="type-condensed tabular w-5 text-sm font-semibold text-ink-3">{slot}</span>
            <span className="type-wide text-lg font-extrabold leading-none sm:text-2xl">
              {driver.code ?? driver.name.slice(0, 3).toUpperCase()}
            </span>
          </span>
          <span className="tabular text-base font-bold sm:text-lg">{pct(driver.probability)}</span>
        </span>
        <span className="flex items-center justify-between gap-2 pl-7.5 text-xs text-ink-2">
          <span className="truncate">{driver.team}</span>
          {showResult && driver.finish_position != null ? (
            <span className={`shrink-0 tabular ${onPodium ? "font-semibold text-paint" : ""}`}>
              Finished P{driver.finish_position}
            </span>
          ) : moved && Math.abs(delta) >= 0.005 ? (
            <span className="shrink-0 tabular text-paint">
              <span aria-hidden className={delta > 0 ? "text-green" : "text-red"}>
                {delta > 0 ? "▲" : "▼"}
              </span>{" "}
              {points(delta)} pts
            </span>
          ) : null}
        </span>
        <span aria-hidden className="ml-7.5 h-1 rounded-full bg-asphalt">
          <span
            className={`block h-full rounded-full ${isTopPick ? "bg-purple" : "bg-paint/70"}`}
            style={{ width: `${Math.max(driver.probability * 100, 1)}%` }}
          />
        </span>
      </button>
    </li>
  );
}
