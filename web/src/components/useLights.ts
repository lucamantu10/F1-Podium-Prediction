import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

/** Five red lights, one per second, a random hold, then lights out -> /predict. */
export function useLights() {
  const navigate = useNavigate();
  const [lit, setLit] = useState(0);
  const [cut, setCut] = useState(false);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const go = useCallback(() => {
    setLit(0);
    setCut(true);
    window.setTimeout(() => navigate({ to: "/predict" }), 60);
  }, [navigate]);

  const run = useCallback(() => {
    if (running) return;
    setRunning(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return go();
    for (let i = 1; i <= 5; i++) timers.current.push(window.setTimeout(() => setLit(i), i * 1000 - 700));
    const hold = 500 + Math.random() * 2000;
    timers.current.push(window.setTimeout(go, 4300 + hold));
  }, [go, running]);

  return { lit, cut, running, run };
}
