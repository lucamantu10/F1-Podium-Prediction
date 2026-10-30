import { Link, useLocation } from "@tanstack/react-router";
import { animate, AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { livery } from "@/lib/teams";
import { cn } from "@/lib/utils";

/* ---------- Logo: the start gantry, five red lights ---------- */
export function LogoMark({ lit = 5, className }: { lit?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 16" className={className} aria-hidden>
      <rect width="64" height="16" rx="8" fill="#141416" stroke="rgba(255,255,255,0.12)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={8 + i * 12} cy="8" r="4" fill={i < lit ? "var(--signal)" : "#2b2b2f"} />
      ))}
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight" aria-label="Lights Out home">
      <LogoMark className="h-3.5 w-14" />
      <span className="hidden sm:inline">Lights Out</span>
    </Link>
  );
}

/* ---------- Buttons: white pill CTA, glass secondary ---------- */
type BtnProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> & {
  variant?: "primary" | "ghost";
};

export function Btn({ children, variant = "primary", className, ...rest }: BtnProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold transition-colors disabled:opacity-40",
        variant === "primary" ? "bg-primary text-primary-foreground hover:bg-white" : "glass text-foreground hover:bg-white/10",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function LinkPill({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground transition hover:-translate-y-px hover:bg-white",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ---------- Floating pill navigation ---------- */
export const NAV = [
  { to: "/predict", label: "Predict" },
  { to: "/drivers", label: "Drivers" },
  { to: "/seasons", label: "Seasons" },
  { to: "/model", label: "Model" },
] as const;

export function PillNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40">
      {/* a soft fade so content scrolling underneath stays out of the way */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#060607] via-[#060607]/80 to-transparent" />
      <div className="pointer-events-auto relative mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 pt-4 md:px-8 md:pt-6">
        <Wordmark />
        <nav aria-label="Main" className="glass hidden items-center gap-1 rounded-full p-1.5 md:flex">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-full px-4 py-2 text-[14px] transition-colors",
                  active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/predict" className="hidden h-10 items-center rounded-full bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition hover:bg-white md:inline-flex">
            Next race
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="glass flex h-10 w-10 items-center justify-center rounded-full md:hidden"
          >
            <span className="relative block h-3 w-4">
              <span className={cn("absolute left-0 h-px w-4 bg-foreground transition", open ? "top-1.5 rotate-45" : "top-0")} />
              <span className={cn("absolute left-0 h-px w-4 bg-foreground transition", open ? "top-1.5 -rotate-45" : "top-3")} />
            </span>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label="Main"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-strong pointer-events-auto mx-4 mt-3 flex flex-col rounded-3xl p-2 md:hidden"
          >
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-[16px] hover:bg-white/10">
                {n.label}
              </Link>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

/** Kept name for older imports. */
export const AppNav = PillNav;

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="night-stage grain relative min-h-screen text-foreground">
      <PillNav />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className={cn("relative mx-auto max-w-[1440px] px-4 pb-32 pt-28 md:px-8 md:pt-36", className)}
      >
        {children}
      </motion.main>
    </div>
  );
}

/* ---------- Glass stat chip ---------- */
export function StatChip({ value, label, className }: { value: ReactNode; label: string; className?: string }) {
  return (
    <div className={cn("glass rounded-2xl px-4 py-3", className)}>
      <p className="stat text-[22px] leading-none text-foreground">{value}</p>
      <p className="mt-1.5 text-[13px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

/* ---------- Loading / errors ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-2xl", className)} aria-hidden />;
}

export function LoadState({ error, onRetry, rows = 4 }: { error?: unknown; onRetry?: () => void; rows?: number }) {
  if (error)
    return (
      <div role="alert" className="glass rounded-3xl p-8">
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
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </C>
  );
}

export function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => c.stop();
  }, [inView, value, reduce]);
  return (
    <span ref={ref} className="tnum">
      {(reduce ? value : v).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ---------- Driver identity ---------- */
export function Portrait({ number, team, size = 44 }: { number: number | null; team: string | null; size?: number }) {
  const l = livery(team);
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
      <circle cx="24" cy="24" r="23" fill="#121214" stroke="rgba(255,255,255,0.1)" />
      <path d="M10 30 C10 17 18 10 27 10 C36 10 40 17 40 26 L40 32 C40 36 37 38 33 38 L15 38 C12 38 10 36 10 33 Z" fill={l.primary} />
      <path d="M17 22 L39 22 L39 28 L20 28 C18 28 17 26 17 25 Z" fill="#0a0a0b" opacity="0.85" />
      <text x="26" y="36" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0a0a0b" style={{ fontFamily: "Inter Tight" }}>
        {number ?? ""}
      </text>
    </svg>
  );
}

export function Stripe({ team, className }: { team: string | null; className?: string }) {
  return <span aria-hidden className={cn("inline-block w-1 shrink-0 rounded-full", className ?? "h-5")} style={{ background: livery(team).primary }} />;
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
    <label className="flex flex-col gap-1.5 text-[13px] text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass h-11 min-w-[8rem] rounded-full px-4 text-[15px] text-foreground [&>option]:bg-[#141416]"
      >
        {children}
      </select>
    </label>
  );
}
