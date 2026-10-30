/**
 * Plackett-Luce race simulator, run in the browser.
 *
 * Mirrors f1podium.models.RaceSimulator: each driver's strength is the dot product
 * of standardised pre-race features with the model weights. A race is simulated by
 * adding Gumbel noise to every strength and sorting, which draws a finishing order
 * from the Plackett-Luce model. Repeating that many times gives win, podium and
 * finishing-position probabilities that are consistent across the field.
 */

export type SimulatorParams = {
  median: number[];
  mean: number[];
  scale: number[];
  coef: number[];
};

export type FeatureInfo = { name: string; label: string; description: string };

export type ModelFile = {
  features: FeatureInfo[];
  final: SimulatorParams;
  folds: Record<string, SimulatorParams>;
};

export type RaceEntry = {
  driverId: number;
  code: string | null;
  name: string;
  team: string | null;
  constructorId: number;
  number: number | null;
  nationality: string | null;
  grid: number;
  qualiPosition: number | null;
  finishPosition: number | null;
  points: number | null;
  status: string | null;
  /** Raw pre-race feature values, in ModelFile.features order (null = missing). */
  features: (number | null)[];
};

export type Circuit = {
  name: string;
  location: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
};

export type RaceFile = {
  raceId: number;
  year: number;
  round: number;
  name: string;
  date: string;
  status: "completed" | "qualifying" | "projected";
  /** "final" or a backtest season key into ModelFile.folds */
  model: string;
  outOfSample: boolean;
  circuit: Circuit;
  /** Race distance in laps (last known for this circuit when not yet raced). */
  laps?: number;
  entries: RaceEntry[];
};

export type Contribution = { feature: string; label: string; impact: number };

export type DriverResult = {
  entry: RaceEntry;
  /** Probability of finishing in each position, index 0 = P1. */
  positions: number[];
  win: number;
  podium: number;
  /** Probability of retiring (only non-zero when the scenario adds retirements). */
  dnf: number;
  expectedPosition: number;
  strength: number;
  /** Largest effects on strength relative to the field average, strongest first. */
  explanation: Contribution[];
};

export type SimulationResult = {
  drivers: DriverResult[]; // sorted by podium probability, highest first
  simulations: number;
};

/**
 * What-if knobs layered on top of the trained model. None of them were learned
 * from data; they are there to play with. Defaults reproduce the model exactly.
 */
export type Scenario = {
  /** Scales the race-day luck. 1 = as trained, 2 = twice as unpredictable. */
  chaos?: number;
  /** Extra retirements as a multiple of each car's recent DNF rate. 0 = off. */
  reliability?: number;
  /** Drivers who retire for certain. */
  retired?: number[];
};

export type SimOptions = Scenario & { simulations?: number; seed?: number; explain?: number };

const PODIUM = 3;

/** Small, fast, seedable PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paramsFor(model: ModelFile, race: RaceFile): SimulatorParams {
  return model.folds[race.model] ?? model.final;
}

function standardise(values: (number | null)[], p: SimulatorParams): number[] {
  return values.map((v, i) => ((v ?? p.median[i]) - p.mean[i]) / p.scale[i]);
}

/**
 * Re-derive the features that depend on the grid after the starting order changes.
 * `order` is the new grid as driverIds, pole first. Qualifying follows the grid,
 * as in f1podium.predict.apply_grid_overrides.
 */
export function applyGrid(entries: RaceEntry[], order: number[], features: FeatureInfo[]): RaceEntry[] {
  const idx = (name: string) => features.findIndex((f) => f.name === name);
  const iGrid = idx("grid");
  const iQuali = idx("quali_position");
  const iPenalty = idx("grid_penalty");
  const iMate = idx("teammate_quali_delta");
  const slot = new Map(order.map((id, i) => [id, i + 1]));

  const moved = entries.map((e) => {
    const grid = slot.get(e.driverId) ?? e.grid;
    const f = [...e.features];
    f[iGrid] = grid;
    f[iQuali] = grid;
    f[iPenalty] = 0;
    return { ...e, grid, qualiPosition: grid, features: f };
  });

  for (const e of moved) {
    const mates = moved.filter((m) => m.constructorId === e.constructorId && m.driverId !== e.driverId);
    e.features[iMate] = mates.length
      ? e.grid - mates.reduce((s, m) => s + m.grid, 0) / mates.length
      : null;
  }
  return moved;
}

/** Strengths and per-feature contributions for a field. */
export function strengthsOf(entries: RaceEntry[], params: SimulatorParams) {
  const parts = entries.map((e) => standardise(e.features, params).map((v, i) => v * params.coef[i]));
  return { parts, strengths: parts.map((row) => row.reduce((s, v) => s + v, 0)) };
}

/** Per-driver probability of an extra retirement under a scenario. */
export function retirementOdds(entries: RaceEntry[], features: FeatureInfo[], params: SimulatorParams, scenario: Scenario = {}) {
  const iDrv = features.findIndex((f) => f.name === "drv_dnf_rate_10");
  const iCon = features.findIndex((f) => f.name === "con_dnf_rate_10");
  const retired = new Set(scenario.retired ?? []);
  const scale = scenario.reliability ?? 0;
  return entries.map((e) => {
    if (retired.has(e.driverId)) return 1;
    if (!scale) return 0;
    const drv = e.features[iDrv] ?? params.median[iDrv];
    const con = e.features[iCon] ?? params.median[iCon];
    return Math.min(0.9, ((drv + con) / 2) * scale);
  });
}

/**
 * Draw one finishing order (indices into the field). Retirements go to the back,
 * in the order they would have run. Returns how many cars finished.
 */
export function drawRace(
  strengths: number[],
  dnfOdds: number[],
  chaos: number,
  random: () => number,
  order: number[],
  noisy: Float64Array,
): number {
  const n = strengths.length;
  let finished = 0;
  for (let i = 0; i < n; i++) {
    // Gumbel(0, 1) noise scaled by chaos; guard against log(0).
    noisy[i] = strengths[i] - chaos * Math.log(-Math.log(random() || Number.MIN_VALUE));
    if (dnfOdds[i] > 0 && random() < dnfOdds[i]) noisy[i] -= 1e6;
    else finished++;
  }
  order.sort((x, y) => noisy[y] - noisy[x]);
  return finished;
}

export function makeRng(seed: number) {
  return rng(seed);
}

export function simulateRace(
  entries: RaceEntry[],
  params: SimulatorParams,
  features: FeatureInfo[],
  { simulations = 10_000, seed = 42, explain = 4, ...scenario }: SimOptions = {},
): SimulationResult {
  const n = entries.length;
  const { parts, strengths } = strengthsOf(entries, params);
  const dnfOdds = retirementOdds(entries, features, params, scenario);
  const chaos = scenario.chaos ?? 1;

  // counts[driver * n + position]
  const counts = new Float64Array(n * n);
  const dnfs = new Float64Array(n);
  const random = rng(seed);
  const noisy = new Float64Array(n);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let s = 0; s < simulations; s++) {
    const finished = drawRace(strengths, dnfOdds, chaos, random, order, noisy);
    for (let p = 0; p < n; p++) {
      counts[order[p] * n + p]++;
      if (p >= finished) dnfs[order[p]]++;
    }
  }

  const fieldMean = features.map((_, j) => parts.reduce((s, row) => s + row[j], 0) / n);

  const drivers = entries.map((entry, i) => {
    const positions = Array.from({ length: n }, (_, p) => counts[i * n + p] / simulations);
    const explanation = features
      .map((f, j) => ({ feature: f.name, label: f.label, impact: parts[i][j] - fieldMean[j] }))
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, explain);
    return {
      entry,
      positions,
      win: positions[0],
      podium: positions.slice(0, PODIUM).reduce((s, v) => s + v, 0),
      dnf: dnfs[i] / simulations,
      expectedPosition: positions.reduce((s, v, p) => s + v * (p + 1), 0),
      strength: strengths[i],
      explanation,
    };
  });
  drivers.sort((a, b) => b.podium - a.podium);
  return { drivers, simulations };
}

/** Convenience wrapper: simulate a race file, optionally with an edited grid. */
export function predictRace(model: ModelFile, race: RaceFile, order?: number[], options: SimOptions = {}) {
  const entries = order ? applyGrid(race.entries, order, model.features) : race.entries;
  return simulateRace(entries, paramsFor(model, race), model.features, { seed: race.raceId, ...options });
}
