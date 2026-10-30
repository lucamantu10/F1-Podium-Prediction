/**
 * One simulated race told lap by lap, for the animated replay.
 *
 * The finishing order is a single draw from the race simulator (so it is as
 * likely as the model says). The laps in between are storytelling: each car's
 * running position eases from its grid slot towards its finishing slot with some
 * wheel-to-wheel noise, and retirements drop out on a random lap.
 */
import { drawRace, makeRng, retirementOdds, strengthsOf, type FeatureInfo, type RaceEntry, type Scenario, type SimulatorParams } from "./simulator";

export type ReplayCar = {
  driverId: number;
  code: string | null;
  name: string;
  team: string | null;
  grid: number;
  finish: number | null; // null = retired
  retiredOnLap: number | null;
};

export type ReplayLap = {
  lap: number;
  /** driverIds in running order; retired cars are listed last. */
  order: number[];
  /** Gap to the leader in seconds, by driverId (null when retired). */
  gaps: Record<number, number | null>;
};

export type Replay = { cars: ReplayCar[]; laps: ReplayLap[]; totalLaps: number; seed: number };

export function simulateReplay(
  entries: RaceEntry[],
  params: SimulatorParams,
  features: FeatureInfo[],
  totalLaps: number,
  { seed = Date.now() % 1_000_000, ...scenario }: Scenario & { seed?: number } = {},
): Replay {
  const random = makeRng(seed);
  const n = entries.length;
  const { strengths } = strengthsOf(entries, params);
  const dnfOdds = retirementOdds(entries, features, params, scenario);
  const order = Array.from({ length: n }, (_, i) => i);
  const finished = drawRace(strengths, dnfOdds, scenario.chaos ?? 1, random, order, new Float64Array(n));

  const finishSlot = new Map<number, number>();
  order.forEach((idx, p) => finishSlot.set(idx, p));
  const cars: ReplayCar[] = entries.map((e, i) => {
    const p = finishSlot.get(i)!;
    const retired = p >= finished;
    return {
      driverId: e.driverId,
      code: e.code,
      name: e.name,
      team: e.team,
      grid: e.grid,
      finish: retired ? null : p + 1,
      retiredOnLap: retired ? 1 + Math.floor(random() * (totalLaps - 1)) : null,
    };
  });

  // Average pace gap per lap between consecutive finishers, about 0.25 s.
  const pace = cars.map((c) => (c.finish ?? n) * 0.25 + random() * 0.1);
  const laps: ReplayLap[] = [];
  const wobble = cars.map(() => random() * Math.PI * 2);
  for (let lap = 0; lap <= totalLaps; lap++) {
    const t = lap / totalLaps;
    const w = t * t * (3 - 2 * t); // smoothstep: settles towards the result late on
    const score = cars.map((c, i) => {
      if (c.retiredOnLap != null && lap >= c.retiredOnLap) return Infinity;
      const target = c.finish ?? n;
      const noise = lap === totalLaps ? 0 : Math.sin(lap * 0.7 + wobble[i]) * 0.9 * (1 - w) + (random() - 0.5) * 0.6 * (1 - w);
      return (1 - w) * c.grid + w * target + noise;
    });
    const running = cars.map((_, i) => i).sort((a, b) => score[a] - score[b]);
    const leaderTime = pace[running[0]] * lap;
    const gaps: Record<number, number | null> = {};
    running.forEach((i, p) => {
      const c = cars[i];
      gaps[c.driverId] = score[i] === Infinity ? null : lap === 0 ? 0 : Math.max(0, pace[i] * lap - leaderTime + p * 0.4);
    });
    laps.push({ lap, order: running.map((i) => cars[i].driverId), gaps });
  }
  return { cars, laps, totalLaps, seed };
}

/** Encode a scenario into URL search params and back, so it can be shared. */
export type SharedScenario = { order?: number[]; chaos?: number; reliability?: number; retired?: number[] };

export function encodeScenario(s: SharedScenario): Record<string, string> {
  const out: Record<string, string> = {};
  if (s.order?.length) out.grid = s.order.join(".");
  if (s.chaos && s.chaos !== 1) out.chaos = s.chaos.toFixed(2);
  if (s.reliability) out.rel = s.reliability.toFixed(2);
  if (s.retired?.length) out.out = s.retired.join(".");
  return out;
}

export function decodeScenario(q: Record<string, unknown>): SharedScenario {
  const list = (v: unknown) =>
    typeof v === "string" && v
      ? v
          .split(".")
          .map(Number)
          .filter((x) => Number.isInteger(x))
      : undefined;
  const num = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
  return { order: list(q.grid), chaos: num(q.chaos), reliability: num(q.rel), retired: list(q.out) };
}
