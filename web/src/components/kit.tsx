import { Link, useLocation } from "@tanstack/react-router";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { livery } from "@/lib/teams";
import { cn } from "@/lib/utils";

/* ---------- Logo: the start gantry ---------- */
export function LogoMark({ lit = 0, className }: { lit?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 16" className={className} aria-hidden>
      <rect width="64" height="16" rx="8" fill="var(--ink)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={8 + i * 12} cy="8" r="4.2" fill={i < lit ? "var(--signal)" : "#2c3b33"} />
      ))}
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="Lights Out home">
      <LogoMark className="h-4 w-16" lit={5} />
      <span>Lights Out</span>
    </Link>
  );
}

/* ---------- Buttons: one shape (square corners) ---------- */
type BtnProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> & {
  variant?: "primary" | "ghost";
};

export function Btn({ children, variant = "primary", className, ...rest }: BtnProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "inline-flex h-12 items-center justify-center px-6 text-[16px] font-semibold transition-colors disabled:opacity-50",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-foreground hover:text-background"
          : "border border-border text-foreground hover:border-foreground",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/* ---------- App navigation ---------- */
const NAV = [
  { to: "/predict", label: "Predict" },
  { to: "/drivers", label: "Drivers" },
  { to: "/seasons", label: "Seasons" },
  { to: "/model", label: "How it works" },
] as const;

export function AppNav() {
  const { pathname } = useLocation();
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-5 md:px-7">
        <Wordmark />
        <nav className="flex gap-4 text-[15px] md:gap-7" aria-label="Main">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "py-1 transition-colors hover:text-foreground",
                  active ? "selected-line text-foreground" : "text-muted-foreground",
                  n.label === "Predict" && "hidden sm:block",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNav />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="mx-auto max-w-[1440px] px-5 pb-32 pt-10 md:px-7"
      >
        {children}
      </motion.main>
    </div>
  );
}

/* ---------- Loading / errors ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function LoadState({ error, onRetry, rows = 4 }: { error?: unknown; onRetry?: () => void; rows?: number }) {
  if (error)
    return (
      <div role="alert" className="border border-border bg-card p-8">
        <p className="text-xl font-semibold">The data didn't load.</p>
        <p className="mt-1 text-muted-foreground">{error instanceof Error ? error.message : "Network error"}</p>
        {onRetry && (
          <Btn className="mt-6" onClick={onRetry}>
            Try again
          </Btn>
        )}
      </div>
    );
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-16 w-2/3" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/* ---------- Motion helpers ---------- */
export function Reveal({
  children,
  i = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  i?: number;
  className?: string;
  as?: "div" | "section";
}) {
  const reduce = useReducedMotion();
  const C = as === "section" ? motion.section : motion.div;
  return (
    <C
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: i * 0.075, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </C>
  );
}

export function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, value, { duration: 1.3, ease: [0.2, 0.7, 0.2, 1], onUpdate: setV });
    return () => c.stop();
  }, [inView, value, reduce]);
  return (
    <span ref={ref} className="tnum">
      {(reduce ? value : v).toLocaleString("en-GB", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* ---------- Driver identity ---------- */
export function Portrait({ number, team, size = 44 }: { number: number | null; team: string | null; size?: number }) {
  const l = livery(team);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <path d="M6 30 C6 14 16 6 27 6 C38 6 44 14 44 26 L44 34 C44 39 40 42 35 42 L12 42 C8 42 6 39 6 35 Z" fill={l.primary} />
      <path d="M14 22 L42 22 L42 29 L18 29 C15 29 14 27 14 25 Z" fill={l.secondary} />
      <text x="26" y="40" textAnchor="middle" fontSize="13" fontWeight="600" fill={l.secondary} style={{ fontFamily: "Switzer" }}>
        {number ?? ""}
      </text>
    </svg>
  );
}

export function Stripe({ team, className }: { team: string | null; className?: string }) {
  return <span aria-hidden className={cn("inline-block w-1 shrink-0", className ?? "h-5")} style={{ background: livery(team).primary }} />;
}

export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-[14px] text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 min-w-[8rem] border border-border bg-card px-3 text-[16px] text-foreground"
      >
        {children}
      </select>
    </label>
  );
}
