import { useEffect, useRef, useState } from 'react';
export function useTimer(startAtSec = 0) {
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(startAtSec);
  const raf = useRef<number | null>(null);
  const anchor = useRef<number | null>(null);
  const loop = (t: number) => {
    if (anchor.current == null) anchor.current = t;
    const delta = (t - anchor.current) / 1000;
    setSec(s => s + delta);
    anchor.current = t;
    raf.current = requestAnimationFrame(loop);
  };
  useEffect(() => {
    if (running) raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [running]);
  const pause = () => { setRunning(false); anchor.current = null; };
  const start = () => setRunning(true);
  const reset = () => { pause(); setSec(0); };
  return { sec, running, start, pause, reset };
}
