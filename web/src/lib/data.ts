import { useQuery } from "@tanstack/react-query";
import type { Circuit, ModelFile } from "./simulator";

/** The JSON bundle written by `f1podium export` (served from public/data). */
export const DATA_URL: string = (import.meta.env.VITE_DATA_URL as string | undefined) ?? "/data";

export type RaceRef = { year: number; round: number; name: string; date: string; status: string; circuit: Circuit };
export type Metrics = {
  log_loss?: number;
  brier?: number;
  roc_auc?: number;
  avg_precision?: number;
  podium_hit_rate: number;
  full_podium_rate?: number;
  top_pick_podium_rate: number;
  races: number;
};
export type IndexFile = {
  version: string;
  generatedAt: string;
  trainedThrough: string;
  modelLabel: string;
  seasons: { year: number; races: number; completed: number }[];
  latestRace: RaceRef;
  nextRace: RaceRef | null;
  headline: {
    podiumHitRate: number;
    topPickPodiumRate: number;
    rocAuc: number;
    logLoss: number;
    gridPodiumHitRate: number;
    racesBacktested: number;
  };
  driverCount: number;
};
export type FullModel = ModelFile & {
  trainedThrough: string;
  backtestSeasons: number[];
  selectedModel: string;
  models: Record<
    string,
    {
      label: string;
      overall: Metrics;
      per_season: Record<string, Metrics>;
      calibration: { predicted: number; observed: number; count: number }[];
    }
  >;
  baseline: { label: string; overall: Metrics; per_season: Record<string, Metrics> };
  featureImportance: { feature: string; label: string; importance: number }[];
};
export type PodiumDriver = { driverId: number; code: string; name: string; team: string; constructorId: number };
export type SeasonFile = {
  year: number;
  podiumHitRate: number | null;
  gridPodiumHitRate: number | null;
  races: {
    round: number;
    name: string;
    date: string;
    circuit: Circuit;
    status: string;
    podium?: PodiumDriver[];
    predictedPodium?: string[];
    podiumHits?: number;
  }[];
  standings: {
    position: number;
    driverId: number;
    code: string;
    name: string;
    points: number;
    wins: number;
    team: string;
    constructorId: number;
  }[];
};
export type DriverSummary = {
  driverId: number;
  code: string | null;
  name: string;
  number: number | null;
  nationality: string | null;
  team: string | null;
  constructorId: number;
  lastSeason: number;
  active: boolean;
  starts: number;
  wins: number;
  podiums: number;
};
type Num = number | null;
type Stats = {
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  points: number;
  dnfs: number;
  avgFinish: Num;
  avgGrid: Num;
  bestFinish: Num;
};
export type DriverFile = {
  driverId: number;
  code: string | null;
  name: string;
  forename: string;
  surname: string;
  number: Num;
  nationality: string | null;
  dateOfBirth: string | null;
  currentTeam: string | null;
  constructorId: number;
  firstRace: { year: number; race: string } | null;
  career: Stats;
  seasons: (Stats & { year: number; team: string; constructorId: number; championshipPosition: Num })[];
  recentRaces: {
    year: number;
    round: number;
    race: string;
    team: string;
    grid: Num;
    qualiPosition: Num;
    finishPosition: Num;
    points: Num;
    status: string | null;
    predictedPodium: Num;
  }[];
  circuits: { race: string; starts: number; wins: number; podiums: number; avgFinish: Num; best: Num }[];
  form: Record<string, Num>;
  teammate: { year: number; name: string; driverId: number; races: number; qualiAhead: number; raceAhead: number } | null;
};

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${DATA_URL}/${path}`);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

export function useData<T>(path: string | null) {
  return useQuery({
    queryKey: ["data", path],
    queryFn: () => getJSON<T>(path!),
    enabled: !!path,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

export const pct = (v: number | null | undefined, d = 0) => (v == null ? "–" : `${(v * 100).toFixed(d)}%`);
export const fmtDate = (s: string) =>
  new Date(s + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
