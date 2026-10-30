import { useState, type ReactNode } from "react";

/* Hand-built SVG charts with axes, a hover tooltip and a legend for 2+ series. */

export type Series = { name: string; color: string; values: (number | null)[]; axis?: "left" | "right"; dashed?: boolean };

export function Legend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-5 text-[14px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.name} className="flex items-center gap-2">
          <svg width="18" height="6" aria-hidden>
            <line x1="0" y1="3" x2="18" y2="3" stroke={i.color} strokeWidth="2" strokeDasharray={i.dashed ? "4 3" : undefined} />
          </svg>
          {i.name}
        </span>
      ))}
    </div>
  );
}

function Tip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const left = Math.min(Math.max(x - 80, 0), w - 160);
  return (
    <div
      className="pointer-events-none absolute z-10 w-40 border border-border bg-raised px-3 py-2 text-[13px] tnum"
      style={{ left: `${(left / w) * 100}%`, top: y }}
    >
      {children}
    </div>
  );
}

type LineProps = {
  labels: string[];
  series: Series[];
  height?: number;
  left: { min: number; max: number; invert?: boolean; format?: (v: number) => string; ticks: number[] };
  right?: { min: number; max: number; format?: (v: number) => string; ticks: number[] };
  tooltip: (i: number) => ReactNode;
  ariaLabel: string;
};

export function LineChart({ labels, series, height = 280, left, right, tooltip, ariaLabel }: LineProps) {
  const W = 800;
  const H = height;
  const m = { l: 44, r: right ? 48 : 14, t: 12, b: 34 };
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const x = (i: number) => m.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - m.l - m.r));
  const yL = (v: number) => {
    const t = (v - left.min) / (left.max - left.min);
    return m.t + (left.invert ? t : 1 - t) * (H - m.t - m.b);
  };
  const yR = (v: number) => (right ? m.t + (1 - (v - right.min) / (right.max - right.min)) * (H - m.t - m.b) : 0);
  const step = Math.max(1, Math.ceil(n / 8));
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      {series.length > 1 && <Legend items={series} />}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1)))));
        }}
      >
        {left.ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={yL(t)} y2={yL(t)} stroke="var(--border)" />
            <text x={m.l - 8} y={yL(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted-foreground)">
              {left.format ? left.format(t) : t}
            </text>
          </g>
        ))}
        {right?.ticks.map((t) => (
          <text key={t} x={W - m.r + 8} y={yR(t) + 4} fontSize="12" fill="var(--muted-foreground)">
            {right.format ? right.format(t) : t}
          </text>
        ))}
        {labels.map(
          (l, i) =>
            i % step === 0 && (
              <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">
                {l}
              </text>
            ),
        )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} stroke="var(--muted-foreground)" />}
        {series.map((s) => {
          const y = s.axis === "right" ? yR : yL;
          let d = "";
          s.values.forEach((v, i) => {
            if (v != null) d += `${d && s.values[i - 1] != null ? "L" : "M"}${x(i)},${y(v)}`;
          });
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "5 4" : undefined} />
              {s.values.map((v, i) => v != null && <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3} fill={s.color} />)}
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <Tip x={(x(hover) / W) * 800} y={8} w={800}>
          {tooltip(hover)}
        </Tip>
      )}
    </div>
  );
}

type ColProps = {
  labels: string[];
  values: number[];
  height?: number;
  color?: (i: number) => string;
  outline?: number | null;
  top?: (i: number) => string | null;
  tooltip: (i: number) => ReactNode;
  ariaLabel: string;
  yFormat?: (v: number) => string;
  max?: number;
};

export function ColumnChart({ labels, values, height = 240, color, outline, top, tooltip, ariaLabel, yFormat, max }: ColProps) {
  const W = 800;
  const H = height;
  const m = { l: 44, r: 8, t: 22, b: 30 };
  const [hover, setHover] = useState<number | null>(null);
  const mx = max ?? Math.max(...values, 1e-9);
  const n = values.length;
  const bw = (W - m.l - m.r) / n;
  const y = (v: number) => m.t + (1 - v / mx) * (H - m.t - m.b);
  const ticks = [0, mx / 2, mx];
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--muted-foreground)">
              {yFormat ? yFormat(t) : Math.round(t)}
            </text>
          </g>
        ))}
        {values.map((v, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={m.l + i * bw} y={m.t} width={bw} height={H - m.t - m.b} fill="transparent" />
            <rect
              x={m.l + i * bw + bw * 0.15}
              y={y(v)}
              width={bw * 0.7}
              height={Math.max(0, H - m.b - y(v))}
              fill={color ? color(i) : "var(--foreground)"}
              opacity={hover == null || hover === i ? 1 : 0.6}
            />
            {outline === i && (
              <rect
                x={m.l + i * bw + bw * 0.08}
                y={m.t - 4}
                width={bw * 0.84}
                height={H - m.t - m.b + 4}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1"
              />
            )}
            {top?.(i) && (
              <text x={m.l + i * bw + bw / 2} y={y(v) - 6} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
                {top(i)}
              </text>
            )}
            {(n <= 20 || i % 2 === 0) && (
              <text x={m.l + i * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">
                {labels[i]}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hover != null && (
        <Tip x={((m.l + hover * bw + bw / 2) / W) * 800} y={0} w={800}>
          {tooltip(hover)}
        </Tip>
      )}
    </div>
  );
}

export function Diverging({ items, unit = "" }: { items: { label: string; value: number }[]; unit?: string }) {
  const mx = Math.max(...items.map((i) => Math.abs(i.value)), 1e-9);
  return (
    <div className="space-y-3" role="list">
      <div className="flex justify-between text-[13px] text-muted-foreground">
        <span>Hurts</span>
        <span>Helps</span>
      </div>
      {items.map((it) => (
        <div key={it.label} role="listitem" aria-label={`${it.label}: ${it.value > 0 ? "helps" : "hurts"}`}>
          <div className="mb-1 flex justify-between text-[14px]">
            <span>{it.label}</span>
            <span className="tnum text-muted-foreground">
              {it.value > 0 ? "+" : ""}
              {it.value.toFixed(2)}
              {unit}
            </span>
          </div>
          <div className="relative h-2 bg-card">
            <div className="absolute top-0 h-2 w-px bg-muted-foreground" style={{ left: "50%" }} />
            <div
              className="absolute top-0 h-2"
              style={{
                background: it.value > 0 ? "var(--helps)" : "var(--hurts)",
                width: `${(Math.abs(it.value) / mx) * 50}%`,
                left: it.value > 0 ? "50%" : `${50 - (Math.abs(it.value) / mx) * 50}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
