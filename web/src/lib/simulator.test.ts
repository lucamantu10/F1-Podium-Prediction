import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyGrid, predictRace, type ModelFile, type RaceFile } from "./simulator";
import { livery } from "./teams";

const data = (path: string) => JSON.parse(readFileSync(new URL(`../../public/data/${path}`, import.meta.url), "utf8"));
const model: ModelFile = data("model.json");
const race: RaceFile = data("races/2025-24.json");

describe("simulator", () => {
  it("produces coherent probabilities", () => {
    const { drivers } = predictRace(model, race, undefined, { simulations: 4000 });
    const sum = (f: (d: (typeof drivers)[number]) => number) => drivers.reduce((s, d) => s + f(d), 0);
    expect(sum((d) => d.win)).toBeCloseTo(1, 6);
    expect(sum((d) => d.podium)).toBeCloseTo(3, 6);
    for (const d of drivers) expect(d.positions.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 6);
    expect(drivers[0].podium).toBeGreaterThanOrEqual(drivers[1].podium);
  });

  it("is deterministic for a race", () => {
    const a = predictRace(model, race, undefined, { simulations: 2000 });
    const b = predictRace(model, race, undefined, { simulations: 2000 });
    expect(a.drivers.map((d) => d.podium)).toEqual(b.drivers.map((d) => d.podium));
  });

  it("moving the last car to pole improves its chances", () => {
    const order = [...race.entries].sort((x, y) => x.grid - y.grid).map((e) => e.driverId);
    const last = order[order.length - 1];
    const before = predictRace(model, race, undefined, { simulations: 4000 }).drivers.find((d) => d.entry.driverId === last)!;
    const after = predictRace(model, race, [last, ...order.slice(0, -1)], { simulations: 4000 }).drivers.find((d) => d.entry.driverId === last)!;
    expect(after.entry.grid).toBe(1);
    expect(after.podium).toBeGreaterThan(before.podium);
  });

  it("applyGrid keeps qualifying in line with the grid", () => {
    const order = [...race.entries].sort((x, y) => y.grid - x.grid).map((e) => e.driverId);
    const moved = applyGrid(race.entries, order, model.features);
    const iGrid = model.features.findIndex((f) => f.name === "grid");
    for (const e of moved) {
      expect(e.qualiPosition).toBe(e.grid);
      expect(e.features[iGrid]).toBe(e.grid);
    }
  });
});

describe("livery", () => {
  it("matches team names and falls back to grey", () => {
    expect(livery("Red Bull").primary).toBe("#3671C6");
    expect(livery("RB F1 Team").primary).toBe("#6692FF");
    expect(livery("Unknown Racing").primary).toBe("#868B93");
  });
});
