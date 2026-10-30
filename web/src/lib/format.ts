export function pct(value: number | null | undefined, digits = 0): string {
  if (value == null) return "–";
  const v = value * 100;
  if (v > 0 && v < 1 && digits === 0) return "<1%";
  return `${v.toFixed(digits)}%`;
}

/** Signed change in percentage points, e.g. "+12" */
export function points(delta: number): string {
  const v = Math.round(delta * 100);
  return v > 0 ? `+${v}` : `${v}`;
}

export function raceDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "Mexico City Grand Prix" -> "Mexico City" */
export function raceShortName(name: string): string {
  return name.replace(/ Grand Prix$/, "");
}
