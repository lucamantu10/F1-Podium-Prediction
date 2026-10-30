// Livery colours, matched on the team name the data uses. Only used as small
// identity marks (the stripe on a grid slot), never as text colour.
const LIVERIES: [RegExp, string][] = [
  [/red bull/i, "#3671C6"],
  [/mercedes/i, "#27F4D2"],
  [/ferrari/i, "#E8002D"],
  [/mclaren/i, "#FF8000"],
  [/aston martin/i, "#229971"],
  [/alpine/i, "#FF87BC"],
  [/williams/i, "#64C4FF"],
  [/haas/i, "#B6BABD"],
  [/audi/i, "#BB0A30"],
  [/sauber|alfa romeo/i, "#52E252"],
  [/cadillac/i, "#C8A24A"],
  [/^rb|racing bulls|alphatauri|toro rosso/i, "#6692FF"],
  [/renault/i, "#FFF500"],
  [/racing point|force india/i, "#F596C8"],
  [/lotus/i, "#FFB800"],
];

export function teamColor(team: string | null | undefined): string {
  if (!team) return "#868b93";
  return LIVERIES.find(([pattern]) => pattern.test(team))?.[1] ?? "#868b93";
}
