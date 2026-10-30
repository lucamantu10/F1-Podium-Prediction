import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeScenario, encodeScenario, simulateReplay } from "./replay";
import { simulateChampionship } from "./season";
import { paramsFor, predictRace, type ModelFile, type RaceFile } from "./simulator";

const data = (path: string) => JSON.parse(readFileSync(new URL(`../../public/data/${path}`, import.meta.url), "utf8"));
const model: ModelFile = data("model.json");
const champ = data("championship.json");
const race: RaceFile = data(`races/${champ.entryListRace}.json`);
const params = paramsFor(model, race);

describe("championship", () => {
  const input = {
    entries: race.entries,
    params,
    features: model.features,
    drivers: champ.drivers,
    teams: champ.teams,
    rounds: champ.remaining.length,
    pointsSystem: champ.pointsSystem,
  };

  it("title odds add up and the leader is favourite", () => {
    const r = simulateChampionship(input, { simulations: 3000 });
    expect(r.drivers.reduce((s, d) => s + d.title, 0)).toBeCloseTo(1, 6);
    expect(r.teams.reduce((s, t) => s + t.title, 0)).toBeCloseTo(1, 6);
    expect(r.decidedAfter.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    expect(r.drivers[0].driverId).toBe(champ.drivers[0].driverId);
    for (const d of r.drivers) expect(d.expectedPoints).toBeGreaterThanOrEqual(d.points);
  });

  it("more chaos gives the chasers more hope", () => {
    // The real 2026 title is all but settled, so test on a level table.
    const level = { ...input, drivers: champ.drivers.map((d: { points: number }) => ({ ...d, points: 0 })) };
    const calm = simulateChampionship(level, { simulations: 3000, chaos: 1 });
    const wild = simulateChampionship(level, { simulations: 3000, chaos: 3 });
    expect(wild.drivers[0].title).toBeLessThan(calm.drivers[0].title);
  });
});

describe("scenario knobs", () => {
  it("a retired driver never scores", () => {
    const top = race.entries[0].driverId;
    const r = predictRace(model, race, undefined, { simulations: 2000, retired: [top] });
    const d = r.drivers.find((x) => x.entry.driverId === top)!;
    expect(d.dnf).toBe(1);
    expect(d.podium).toBe(0);
  });

  it("defaults reproduce the plain model", () => {
    const a = predictRace(model, race, undefined, { simulations: 2000 });
    const b = predictRace(model, race, undefined, { simulations: 2000, chaos: 1, reliability: 0 });
    expect(a.drivers.map((d) => d.podium)).toEqual(b.drivers.map((d) => d.podium));
  });
});

describe("replay", () => {
  it("starts on the grid and ends on the drawn result", () => {
    const r = simulateReplay(race.entries, params, model.features, race.laps ?? 60, { seed: 3, reliability: 1 });
    expect(r.laps).toHaveLength(r.totalLaps + 1);
    const byGrid = [...race.entries].sort((a, b) => a.grid - b.grid).map((e) => e.driverId);
    expect(r.laps[0].order.slice(0, 3)).toEqual(byGrid.slice(0, 3));
    const finishers = r.cars.filter((c) => c.finish != null).sort((a, b) => a.finish! - b.finish!);
    expect(r.laps[r.totalLaps].order.slice(0, finishers.length)).toEqual(finishers.map((c) => c.driverId));
  });

  it("scenarios survive a URL round trip", () => {
    const s = { order: [1, 2, 3], chaos: 1.5, reliability: 0.5, retired: [9] };
    expect(decodeScenario(encodeScenario(s))).toEqual(s);
  });
});
