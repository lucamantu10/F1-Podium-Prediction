import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { CarSilhouette } from "@/components/car/CarSilhouette";
import { LinkPill, LogoMark, PillNav, StatChip } from "@/components/kit";
import { fmtDate, pct, useData, type IndexFile } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lights Out — who makes the podium?" },
      { name: "description", content: "Formula 1 podium predictions from 10,000 simulated races, tested on every Grand Prix since 2014." },
    ],
  }),
  component: Home,
});

const ease = [0.16, 1, 0.3, 1] as const;

function Home() {
  const { data: index } = useData<IndexFile>("index.json");
  const next = index?.nextRace ?? index?.latestRace;
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // The car rolls forward and the title lifts away as you scroll off the hero.
  const carX = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "18%"]);
  const carScale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.12]);
  const titleY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-30%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <div className="night-stage grain relative min-h-screen overflow-hidden">
      <PillNav />
      <section ref={ref} className="relative flex min-h-[100svh] flex-col px-4 pb-8 pt-24 md:px-8 md:pt-28">
        {/* light streaks on the straight */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[58%] h-40">
          <span className="light-streak" style={{ top: "10%", animationDelay: "0s" }} />
          <span className="light-streak red" style={{ top: "55%", animationDelay: "2.4s", animationDuration: "9s" }} />
          <span className="light-streak" style={{ top: "85%", animationDelay: "4.8s", animationDuration: "11s" }} />
        </div>
        <div aria-hidden className="wet-floor pointer-events-none absolute inset-x-0 bottom-0 h-[42%]" />

        <div className="relative mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 items-center gap-8 lg:grid-cols-[210px_minmax(0,1fr)_auto]">
          {/* glass stat chips */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.1, delay: 0.5, ease }}
            className="order-3 grid grid-cols-3 gap-2 lg:order-1 lg:grid-cols-1 lg:gap-3"
          >
            <StatChip value={index ? pct(index.headline.podiumHitRate, 1) : "–"} label="podium places called" />
            <StatChip value={index ? index.headline.racesBacktested : "–"} label="races evaluated" />
            <StatChip value={index ? `v${index.version}` : "–"} label="Plackett-Luce model" />
          </motion.div>

          {/* the car */}
          <motion.div style={{ x: carX, scale: carScale }} className="relative order-2 lg:order-2 lg:-mr-10 xl:-mr-16">
            {/* spotlight pool behind the car */}
            <div aria-hidden className="absolute inset-x-[5%] top-[10%] h-[70%] rounded-[50%] bg-white/[0.06] blur-3xl" />
            <motion.div
              initial={{ opacity: 0, x: "-12%" }}
              animate={{ opacity: 1, x: "0%" }}
              transition={{ duration: 1.6, ease }}
            >
              <CarSilhouette className="relative w-full scale-110 drop-shadow-[0_30px_60px_rgba(0,0,0,0.9)]" />
            </motion.div>
          </motion.div>

          {/* title */}
          <motion.div style={{ y: titleY, opacity: fade }} className="relative order-1 lg:order-3">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease }}
              className="mb-4 text-[15px] text-muted-foreground"
            >
              {next ? (
                <>
                  Next: <span className="text-foreground">{next.name}</span>, {fmtDate(next.date)}
                </>
              ) : (
                "Loading the calendar…"
              )}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.3, ease }}
              className="display whitespace-nowrap text-[clamp(52px,6.4vw,112px)]"
            >
              Who makes
              <br />
              the podium?
            </motion.h1>
          </motion.div>
        </div>

        {/* CTA and tagline */}
        <div className="relative mx-auto mt-6 grid w-full max-w-[1440px] grid-cols-1 items-end gap-6 md:grid-cols-3">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
            className="order-2 flex gap-6 text-[13px] text-dim md:order-1"
          >
            <span>Grid</span>
            <span>Form</span>
            <span>10,000 races</span>
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.8, ease }}
            className="order-1 flex justify-center md:order-2"
          >
            <LinkPill to="/predict" className="h-14 px-9 text-[16px]">
              See the prediction
            </LinkPill>
          </motion.div>
          <div className="order-3 hidden items-center justify-end gap-2 text-[13px] text-dim md:flex">
            <LogoMark className="h-3 w-12" />
            <span>Lights Out</span>
          </div>
        </div>
      </section>

      <footer className="relative mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-10 text-[13px] text-dim md:flex-row md:justify-between md:px-8">
        <p>Race data from the Ergast archive and the Jolpica API. Predictions are model estimates, not betting advice.</p>
        <p>
          <Link to="/model" className="hover:text-foreground">
            How the model works
          </Link>
        </p>
      </footer>
    </div>
  );
}
