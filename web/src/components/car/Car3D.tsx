import { useReducedMotion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CarProfile } from "./CarProfile";

// three.js is only downloaded when a car is actually shown.
const Scene = lazy(() => import("./CarScene"));

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export type CarProps = { primary: string; secondary: string; number?: number | null; className?: string };

export function Car3D({ primary, secondary, number, className }: CarProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [gl] = useState(hasWebGL);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Render frames only while the car is on screen.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const fallback = (
    <div className="flex h-full items-center px-4">
      <CarProfile primary={primary} secondary={secondary} number={number} />
    </div>
  );

  return (
    <div className={className ?? "h-72 w-full"}>
      <div
        ref={ref}
        className="h-full w-full"
        role="img"
        aria-label={`3D race car in team livery${number ? `, number ${number}` : ""}. Drag to rotate.`}
      >
        {!gl || reduce ? (
          fallback
        ) : (
          <Suspense fallback={fallback}>
            <Scene primary={primary} secondary={secondary} number={number ?? null} active={visible} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
