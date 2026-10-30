import type { components } from "./api-types";

export type Meta = components["schemas"]["Meta"];
export type RaceSummary = components["schemas"]["RaceSummary"];
export type RacePrediction = components["schemas"]["RacePrediction"];
export type DriverPrediction = components["schemas"]["DriverPrediction"];
export type Contribution = components["schemas"]["Contribution"];
export type Season = components["schemas"]["Season"];

export type SeasonMetrics = {
  log_loss: number;
  brier: number;
  roc_auc: number;
  avg_precision: number;
  podium_hit_rate: number;
  full_podium_rate: number;
  top_pick_podium_rate: number;
  races: number;
};

export type ModelMetrics = {
  selected_model: string;
  trained_through: string;
  train_start_year: number;
  backtest_seasons: number[];
  models: Record<
    string,
    {
      label: string;
      overall: SeasonMetrics;
      per_season: Record<string, SeasonMetrics>;
      calibration: { predicted: number; observed: number; count: number }[];
    }
  >;
  baseline: {
    label: string;
    overall: Pick<SeasonMetrics, "podium_hit_rate" | "top_pick_podium_rate" | "races">;
    per_season: Record<string, Pick<SeasonMetrics, "podium_hit_rate" | "races">>;
  };
  feature_importance: { feature: string; label: string; importance: number }[];
  features: { name: string; label: string; description: string }[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const SERVER_API = process.env.API_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Server components call the API directly; the browser goes through the rewrite.
  const base = typeof window === "undefined" ? SERVER_API : "";
  const res = await fetch(`${base}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => request<Meta>("/api/meta"),
  seasonRaces: (year: number) => request<RaceSummary[]>(`/api/seasons/${year}/races`),
  race: (year: number, round: number) => request<RacePrediction>(`/api/races/${year}/${round}`),
  model: () => request<ModelMetrics>("/api/model"),
  scenario: (year: number, round: number, grid: Record<number, number>) =>
    request<RacePrediction>(`/api/races/${year}/${round}/scenario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grid }),
    }),
};
