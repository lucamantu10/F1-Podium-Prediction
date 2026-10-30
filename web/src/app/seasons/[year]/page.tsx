import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiError, api, type RaceSummary } from "@/lib/api";
import { pct, raceShortName, shortDate } from "@/lib/format";

export default function SeasonPage({ params }: PageProps<"/seasons/[year]">) {
  return (
    <Suspense fallback={<div className="mt-14 h-[32rem] animate-pulse rounded-sm bg-asphalt-2" />}>
      <Season params={params} />
    </Suspense>
  );
}

async function Season({ params }: { params: PageProps<"/seasons/[year]">["params"] }) {
  const year = Number((await params).year);
  if (!Number.isInteger(year)) notFound();
  const [races, model] = await Promise.all([
    api.seasonRaces(year).catch((error) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    api.model(),
  ]);
  const ours = model.models[model.selected_model].per_season[String(year)];
  const grid = model.baseline.per_season[String(year)];
  const completed = races.filter((r) => r.status === "completed").length;

  return (
    <>
      <header className="pt-10 sm:pt-14">
        <p className="text-sm text-ink-2">
          <Link href="/seasons" className="underline decoration-line underline-offset-4 hover:text-paint">
            All seasons
          </Link>
        </p>
        <h1 className="type-wide mt-2 text-[clamp(2.75rem,8vw,6rem)] font-black leading-none tracking-tight">
          {year}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-2">
          {ours && grid ? (
            <>
              Across {completed} races the model called{" "}
              <span className="font-semibold text-paint">{pct(ours.podium_hit_rate)}</span> of podium
              places. Taking the first three on the grid would have called {pct(grid.podium_hit_rate)}.
            </>
          ) : (
            `${completed} of ${races.length} races run so far.`
          )}
        </p>
      </header>

      <div className="mt-10 overflow-x-auto">
        <table className="tabular w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">{year} races with the model&apos;s pick and the result</caption>
          <thead className="text-xs text-ink-3">
            <tr className="border-b border-line">
              <th scope="col" className="w-16 py-2 font-medium">Round</th>
              <th scope="col" className="py-2 font-medium">Race</th>
              <th scope="col" className="py-2 font-medium">Winner</th>
              <th scope="col" className="py-2 font-medium">Model&apos;s top pick</th>
              <th scope="col" className="py-2 text-right font-medium">Podium called</th>
            </tr>
          </thead>
          <tbody>
            {races.map((race) => (
              <RaceRow key={race.round} race={race} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RaceRow({ race }: { race: RaceSummary }) {
  const predictable = race.status !== "scheduled";
  return (
    <tr className={`border-b border-line/60 ${predictable ? "" : "text-ink-3"}`}>
      <td className="py-3 text-ink-3">{race.round}</td>
      <th scope="row" className="py-3 font-normal">
        {predictable ? (
          <Link
            href={`/races/${race.year}/${race.round}`}
            className="type-wide text-base font-bold text-paint hover:underline hover:underline-offset-4"
          >
            {raceShortName(race.name)}
          </Link>
        ) : (
          <span className="type-wide text-base font-bold">{raceShortName(race.name)}</span>
        )}
        <span className="block text-xs text-ink-3">{shortDate(race.date)}</span>
      </th>
      <td className="py-3">{race.winner?.name ?? (race.status === "completed" ? "–" : "")}</td>
      <td className="py-3 text-ink-2">{race.predicted_winner?.name ?? ""}</td>
      <td className="py-3 text-right">
        {race.podium_hits != null ? (
          <Hits hits={race.podium_hits} />
        ) : race.status === "scheduled" ? (
          "Not yet"
        ) : (
          <span className="inline-flex items-center gap-2 text-ink-2">
            <span aria-hidden className="h-2 w-2 rounded-full bg-yellow" />
            {race.status === "projected" ? "Next race, grid projected" : "Next race"}
          </span>
        )}
      </td>
    </tr>
  );
}

function Hits({ hits }: { hits: number }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="sr-only">{hits} of 3</span>
      <span aria-hidden className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-[2px] ${i < hits ? "bg-purple" : "border border-line"}`}
          />
        ))}
      </span>
      <span aria-hidden className="w-4 text-ink-2">
        {hits}
      </span>
    </span>
  );
}
