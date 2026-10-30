import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { api } from "@/lib/api";
import { pct } from "@/lib/format";

export const metadata: Metadata = { title: "Seasons" };

export default function SeasonsPage() {
  return (
    <>
      <header className="pt-10 sm:pt-14">
        <h1 className="type-wide text-[clamp(2.25rem,6vw,4.5rem)] font-black leading-none tracking-tight">
          Seasons
        </h1>
        <p className="mt-4 max-w-2xl text-ink-2">
          Every race since 2014, predicted by a model that was trained only on earlier seasons. Pick
          a season to see each race next to what actually happened.
        </p>
      </header>
      <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-sm bg-asphalt-2" />}>
        <SeasonList />
      </Suspense>
    </>
  );
}

async function SeasonList() {
  const [meta, model] = await Promise.all([api.meta(), api.model()]);
  const primary = model.models[model.selected_model].per_season;
  const seasons = [...meta.seasons].reverse();

  return (
    <table className="tabular mt-10 w-full text-left">
      <caption className="sr-only">Podium places called per season</caption>
      <thead className="text-xs text-ink-3">
        <tr className="border-b border-line">
          <th scope="col" className="py-2 font-medium">Season</th>
          <th scope="col" className="py-2 font-medium">Races run</th>
          <th scope="col" className="py-2 text-right font-medium">Podium places called</th>
          <th scope="col" className="hidden py-2 text-right font-medium sm:table-cell">
            Grid order would have called
          </th>
        </tr>
      </thead>
      <tbody>
        {seasons.map((s) => {
          const m = primary[String(s.year)];
          const grid = model.baseline.per_season[String(s.year)];
          return (
            <tr key={s.year} className="border-b border-line/60">
              <th scope="row" className="py-3">
                <Link
                  href={`/seasons/${s.year}`}
                  className="type-wide text-xl font-extrabold hover:underline hover:underline-offset-4"
                >
                  {s.year}
                </Link>
              </th>
              <td className="py-3 text-ink-2">
                {s.completed === s.races ? s.races : `${s.completed} of ${s.races}`}
              </td>
              <td className="py-3 text-right text-lg font-semibold">{m ? pct(m.podium_hit_rate) : "–"}</td>
              <td className="hidden py-3 text-right text-ink-2 sm:table-cell">
                {grid ? pct(grid.podium_hit_rate) : "–"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
