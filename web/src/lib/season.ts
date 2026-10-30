/**
 * Championship simulator: play out the rest of the season many times.
 *
 * Every remaining round is drawn from the next race's entry list and strengths
 * (the only grid we know), so it answers "if the field stays as it is now, who
 * takes the title?". Sprint races are not included.
 */
import { drawRace, makeRng, retirementOdds, strengthsOf, type FeatureInfo, type RaceEntry, type Scenario, type SimulatorParams } from "./simulator";

export type Standing = { driverId: number; code: string | null; name: string; team: string | null; constructorId: number | null; points: number };
export type TeamStanding = { constructorId: number; name: string; points: number };

export type ChampionshipInput = {
  entries: RaceEntry[];
  params: SimulatorParams;
  features: FeatureInfo[];
  drivers: Standing[];
  teams: TeamStanding[];
  rounds: number;
  pointsSystem: number[];
};

export type DriverOdds = {
  driverId: number;
  code: string | null;
  name: string;
  team: string | null;
  constructorId: number | null;
  points: number;
  title: number;
  expectedPoints: number;
  /** 10th and 90th percentile of final points. */
  range: [number, number];
  /** Probability of each final championship position, index 0 = champion. */
  positions: number[];
};

export type TeamOdds = { constructorId: number; name: string; points: number; title: number; expectedPoints: number };

export type ChampionshipResult = {
  drivers: DriverOdds[];
  teams: TeamOdds[];
  /** Probability the title is decided after each remaining round (index 0 = next round). */
  decidedAfter: number[];
  simulations: number;
};

function percentile(sorted: Float64Array, q: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export function simulateChampionship(
  input: ChampionshipInput,
  { simulations = 10_000, seed = 7, ...scenario }: Scenario & { simulations?: number; seed?: number } = {},
): ChampionshipResult {
  const { entries, params, features, drivers, teams, rounds, pointsSystem } = input;
  const { strengths } = strengthsOf(entries, params);
  const dnfOdds = retirementOdds(entries, features, params, scenario);
  const chaos = scenario.chaos ?? 1;
  const random = makeRng(seed);
  const n = entries.length;
  const order = Array.from({ length: n }, (_, i) => i);
  const noisy = new Float64Array(n);

  // Championship table: everyone with points plus everyone on the entry list.
  const table = new Map<number, Standing>(drivers.map((d) => [d.driverId, d]));
  for (const e of entries)
    if (!table.has(e.driverId))
      table.set(e.driverId, { driverId: e.driverId, code: e.code, name: e.name, team: e.team, constructorId: e.constructorId, points: 0 });
  const ids = [...table.keys()];
  const slot = new Map(ids.map((id, i) => [id, i]));
  const entrySlot = entries.map((e) => slot.get(e.driverId)!);
  const basePoints = ids.map((id) => table.get(id)!.points);

  const teamIds = [...new Set([...teams.map((t) => t.constructorId), ...entries.map((e) => e.constructorId)])];
  const teamSlot = new Map(teamIds.map((id, i) => [id, i]));
  const entryTeam = entries.map((e) => teamSlot.get(e.constructorId)!);
  const teamBase = teamIds.map((id) => teams.find((t) => t.constructorId === id)?.points ?? 0);

  const m = ids.length;
  const titles = new Float64Array(m);
  const sumPoints = new Float64Array(m);
  const finals = Array.from({ length: m }, () => new Float64Array(simulations));
  const finishPos = new Float64Array(m * m);
  const teamTitles = new Float64Array(teamIds.length);
  const teamSum = new Float64Array(teamIds.length);
  const decided = new Float64Array(rounds);
  const maxPerRound = pointsSystem[0];

  const pts = new Float64Array(m);
  const tpts = new Float64Array(teamIds.length);
  const rank = Array.from({ length: m }, (_, i) => i);
  const trank = Array.from({ length: teamIds.length }, (_, i) => i);

  for (let s = 0; s < simulations; s++) {
    pts.set(basePoints);
    tpts.set(teamBase);
    let decidedAt = -1;
    for (let r = 0; r < rounds; r++) {
      const finished = drawRace(strengths, dnfOdds, chaos, random, order, noisy);
      for (let p = 0; p < Math.min(pointsSystem.length, finished); p++) {
        const i = order[p];
        pts[entrySlot[i]] += pointsSystem[p];
        tpts[entryTeam[i]] += pointsSystem[p];
      }
      if (decidedAt < 0) {
        let first = -Infinity;
        let second = -Infinity;
        for (let i = 0; i < m; i++) {
          if (pts[i] > first) {
            second = first;
            first = pts[i];
          } else if (pts[i] > second) second = pts[i];
        }
        if (first - second > maxPerRound * (rounds - r - 1)) decidedAt = r;
      }
    }
    if (decidedAt >= 0) decided[decidedAt]++;
    else decided[rounds - 1]++;

    // Ties broken at random (count-back on wins is not modelled).
    rank.sort((a, b) => pts[b] - pts[a] || random() - 0.5);
    titles[rank[0]]++;
    for (let p = 0; p < m; p++) finishPos[rank[p] * m + p]++;
    for (let i = 0; i < m; i++) {
      sumPoints[i] += pts[i];
      finals[i][s] = pts[i];
    }
    trank.sort((a, b) => tpts[b] - tpts[a] || random() - 0.5);
    teamTitles[trank[0]]++;
    for (let i = 0; i < teamIds.length; i++) teamSum[i] += tpts[i];
  }

  const driversOut = ids.map((id, i) => {
    const sorted = finals[i].sort();
    const d = table.get(id)!;
    return {
      ...d,
      title: titles[i] / simulations,
      expectedPoints: sumPoints[i] / simulations,
      range: [percentile(sorted, 0.1), percentile(sorted, 0.9)] as [number, number],
      positions: Array.from({ length: m }, (_, p) => finishPos[i * m + p] / simulations),
    };
  });
  driversOut.sort((a, b) => b.title - a.title || b.expectedPoints - a.expectedPoints);

  const teamsOut = teamIds.map((id, i) => ({
    constructorId: id,
    name: teams.find((t) => t.constructorId === id)?.name ?? entries.find((e) => e.constructorId === id)?.team ?? "",
    points: teamBase[i],
    title: teamTitles[i] / simulations,
    expectedPoints: teamSum[i] / simulations,
  }));
  teamsOut.sort((a, b) => b.title - a.title || b.expectedPoints - a.expectedPoints);

  return { drivers: driversOut, teams: teamsOut, decidedAfter: Array.from(decided, (v) => v / simulations), simulations };
}
