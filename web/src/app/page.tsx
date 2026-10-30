import Link from "next/link";
import { Suspense } from "react";
import { loadRace, RaceContent, RaceSkeleton } from "@/components/race/RacePage";
import { api, type RaceSummary } from "@/lib/api";
import { raceShortName } from "@/lib/format";

export default function Home() {
  return (
    <Suspense fallback={<RaceSkeleton />}>
      <NextRace />
    </Suspense>
  );
}

async function NextRace() {
  const meta = await api.meta();
  const race = meta.next_race ?? meta.latest_race;
  if (!race) return <p className="pt-14 text-ink-2">No races are available yet.</p>;
  const prediction = await loadRace(race.year, race.round);
  const latest = meta.next_race ? meta.latest_race : null;

  return (
    <>
      <RaceContent prediction={prediction} />
      {latest && <LastRace race={latest} />}
    </>
  );
}

function LastRace({ race }: { race: RaceSummary }) {
  return (
    <aside className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
      <p className="text-ink-2">
        Last time out, in {raceShortName(race.name)}, the model called{" "}
        <span className="font-semibold text-paint">{race.podium_hits ?? 0} of 3</span> podium places
        {race.winner ? ` and ${race.winner.name} won` : ""}.
      </p>
      <Link
        href={`/races/${race.year}/${race.round}`}
        className="rounded-sm border border-line px-4 py-2 text-sm hover:bg-asphalt-2"
      >
        See that race
      </Link>
    </aside>
  );
}
