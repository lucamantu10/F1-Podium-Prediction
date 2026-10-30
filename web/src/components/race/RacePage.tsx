import { notFound } from "next/navigation";
import { ApiError, api, type RacePrediction } from "@/lib/api";
import { RaceHeader } from "./RaceHeader";
import { RaceView } from "./RaceView";

export async function loadRace(year: number, round: number): Promise<RacePrediction> {
  try {
    return await api.race(year, round);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export function RaceContent({ prediction }: { prediction: RacePrediction }) {
  return (
    <>
      <RaceHeader prediction={prediction} />
      <RaceView initial={prediction} />
    </>
  );
}

export function RaceSkeleton() {
  return (
    <div aria-busy className="animate-pulse pt-14">
      <div className="h-4 w-40 rounded bg-asphalt-2" />
      <div className="mt-4 h-16 w-3/4 rounded bg-asphalt-2" />
      <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-3 lg:w-7/12">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={`h-20 rounded-sm bg-asphalt-2 ${i % 2 ? "mt-11" : ""}`} />
        ))}
      </div>
      <span className="sr-only">Loading race prediction</span>
    </div>
  );
}
