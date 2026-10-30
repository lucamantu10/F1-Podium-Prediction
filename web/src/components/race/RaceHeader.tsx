import Link from "next/link";
import type { RacePrediction } from "@/lib/api";
import { raceDate } from "@/lib/format";

const STATUS_NOTE: Record<string, string> = {
  projected:
    "Qualifying hasn't run yet, so the grid is projected from each driver's last three qualifying results. It updates once qualifying is in.",
  qualifying: "The grid is set by qualifying. Penalties applied after qualifying may still move it.",
};

export function RaceHeader({ prediction }: { prediction: RacePrediction }) {
  const { race, out_of_sample: outOfSample } = prediction;
  const note =
    race.status === "completed"
      ? outOfSample
        ? `Predicted by a model trained only on seasons before ${race.year}, so it never saw this race.`
        : "This season was part of the model's training data."
      : STATUS_NOTE[race.status];

  return (
    <header className="pt-10 sm:pt-14">
      <p className="text-sm text-ink-2">
        <Link href={`/seasons/${race.year}`} className="underline decoration-line underline-offset-4 hover:text-paint">
          {race.year} season
        </Link>
        , round {race.round}
      </p>
      <h1 className="type-wide mt-2 text-[clamp(2.25rem,7vw,5.25rem)] font-black leading-[0.95] tracking-tight [overflow-wrap:anywhere]">
        {race.name}
      </h1>
      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="sr-only">Date</dt>
          <dd>{raceDate(race.date)}</dd>
        </div>
        <div>
          <dt className="sr-only">Circuit</dt>
          <dd className="text-ink-2">
            {race.circuit.name}
            {race.circuit.location ? `, ${race.circuit.location}` : ""}
          </dd>
        </div>
      </dl>
      {note && (
        <p className="mt-5 flex max-w-2xl gap-3 text-sm text-ink-2">
          <span
            aria-hidden
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${race.status === "projected" ? "bg-yellow" : race.status === "completed" ? "bg-green" : "bg-paint"}`}
          />
          {note}
        </p>
      )}
    </header>
  );
}
