// Livery colours, matched on the team name the data uses. Used on data (stripes,
// bars, the 3D car), never as chrome or text colour.
export type Livery = { primary: string; secondary: string };

const TABLE: [RegExp, Livery][] = [
  [/red bull/i, { primary: "#3671C6", secondary: "#1B2A5E" }],
  [/mercedes/i, { primary: "#27F4D2", secondary: "#111111" }],
  [/ferrari/i, { primary: "#E8002D", secondary: "#FFEB00" }],
  [/mclaren/i, { primary: "#FF8000", secondary: "#1E1E1E" }],
  [/aston martin/i, { primary: "#229971", secondary: "#CEDC00" }],
  [/alpine/i, { primary: "#FF87BC", secondary: "#0093CC" }],
  [/williams/i, { primary: "#64C4FF", secondary: "#00205B" }],
  [/haas/i, { primary: "#B6BABD", secondary: "#E6002B" }],
  [/audi/i, { primary: "#BB0A30", secondary: "#C0C0C0" }],
  [/sauber|kick|alfa romeo/i, { primary: "#52E252", secondary: "#111111" }],
  [/cadillac/i, { primary: "#C8A24A", secondary: "#111111" }],
  [/^rb\b|racing bulls|alphatauri|toro rosso/i, { primary: "#6692FF", secondary: "#FFFFFF" }],
  [/renault/i, { primary: "#FFF500", secondary: "#000000" }],
  [/racing point|force india/i, { primary: "#F596C8", secondary: "#111111" }],
];

export function livery(team: string | null | undefined): Livery {
  if (team) for (const [re, l] of TABLE) if (re.test(team.trim())) return l;
  return { primary: "#868B93", secondary: "#2A2E33" };
}
