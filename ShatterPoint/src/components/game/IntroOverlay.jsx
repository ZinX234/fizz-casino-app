import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import FizzMark from "@/components/game/FizzMark";

const TITLE = "SHATTERPOINT";

export default function IntroOverlay({ onDone }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const total = 4600;
    const id = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / total);
      setProgress(p);
      if (p >= 1) {
        window.clearInterval(id);
        onDone();
      }
    }, 60);
    return () => window.clearInterval(id);
  }, [onDone]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#04050a] px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(182,255,60,0.16),transparent_62%)] blur-2xl" />
        <div className="absolute left-1/2 top-1/2 h-[46vh] w-[46vh] -translate-x-1/2 -translate-y-[62%] rounded-full bg-[radial-gradient(circle,rgba(255,46,154,0.16),transparent_62%)] blur-2xl" />
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 60, rotate: -20 }}
            animate={{ opacity: [0, 0.7, 0], y: [-10, -240], rotate: 30 }}
            transition={{ duration: 6 + (i % 4), delay: i * 0.35, repeat: Infinity, ease: "linear" }}
            className="absolute block h-3 w-2 border border-white/30 bg-white/10"
            style={{ left: `${8 + i * 8.4}%`, top: `${62 + (i % 3) * 9}%` }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative"
      >
        <FizzMark />
      </motion.div>

      <div className="relative mt-8 flex justify-center overflow-hidden">
        <h1 className="flex font-heading text-[clamp(1.9rem,8.4vw,4.4rem)] font-bold uppercase leading-none tracking-[0.02em] text-white">
          {TITLE.split("").map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.25 + i * 0.045, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className={char === " " ? "w-2" : "title-glow"}
            >
              {char}
            </motion.span>
          ))}
        </h1>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.15, duration: 0.9 }}
        className="relative mt-4 max-w-[34ch] text-center text-[11px] uppercase tracking-[0.3em] text-white/35"
      >
        The bridge remembers every choice
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.7 }}
        className="relative mt-10 flex flex-col items-center gap-4"
      >
        <button
          type="button"
          onClick={onDone}
          className="group relative overflow-hidden rounded-xl bg-[#b6ff3c] px-9 py-3.5 font-heading text-[11px] font-bold uppercase tracking-[0.26em] text-[#05060a] shadow-[0_0_50px_-12px_rgba(182,255,60,0.9)] transition-all hover:brightness-110"
        >
          Enter arena
        </button>
        <button
          type="button"
          onClick={onDone}
          className="font-heading text-[9px] uppercase tracking-[0.3em] text-white/30 transition-colors hover:text-white/70"
        >
          Skip intro
        </button>
        <div className="mt-2 h-px w-40 overflow-hidden bg-white/10">
          <div
            className="h-full bg-[#b6ff3c] transition-[width] duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </motion.div>
    </div>
  );
}