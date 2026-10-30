import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadRace, RaceContent, RaceSkeleton } from "@/components/race/RacePage";

export default function RacePage({ params }: PageProps<"/races/[year]/[round]">) {
  return (
    <Suspense fallback={<RaceSkeleton />}>
      <Race params={params} />
    </Suspense>
  );
}

async function Race({ params }: { params: PageProps<"/races/[year]/[round]">["params"] }) {
  const { year, round } = await params;
  const y = Number(year);
  const r = Number(round);
  if (!Number.isInteger(y) || !Number.isInteger(r)) notFound();
  return <RaceContent prediction={await loadRace(y, r)} />;
}
