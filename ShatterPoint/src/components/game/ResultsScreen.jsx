import { motion } from "framer-motion";
import { Crown, Home, RotateCcw, TriangleAlert } from "lucide-react";
import NeonButton from "@/components/game/ui/NeonButton";
import { formatDuration } from "@/game/engine";
import { cn } from "@/lib/utils";

export default function ResultsScreen({ result, stats, onRestart, onMenu }) {
  const won = result.status === "victory";
  const reached = Math.min(result.stagesCompleted + (won ? 0 : 1), result.stages);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_50%_35%,rgba(6,7,11,0.55),rgba(4,5,8,0.94))] px-4 py-6 backdrop-blur-[3px]">
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(165deg,rgba(20,24,30,0.92),rgba(8,10,14,0.96))] p-6 shadow-[0_50px_140px_-40px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-8"
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-40",
            won
              ? "bg-[radial-gradient(ellipse_at_50%_0%,rgba(182,255,60,0.22),transparent_70%)]"
              : "bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,46,154,0.2),transparent_70%)]",
          )}
        />

        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 font-heading text-[8.5px] uppercase tracking-[0.24em] text-white/50">
            {result.mode === "real" ? "Real play" : "Demo mode"}
          </span>
          <span className="font-heading text-[8.5px] uppercase tracking-[0.24em] text-white/25">
            Run report
          </span>
        </div>

        <h2
          className={cn(
            "relative mt-4 font-heading text-[clamp(1.7rem,6.2vw,2.6rem)] font-bold uppercase leading-[0.98] tracking-[0.02em]",
            won
              ? "bg-gradient-to-br from-white via-[#e8ffc0] to-[#b6ff3c] bg-clip-text text-transparent"
              : "bg-gradient-to-br from-white via-[#ffd0e6] to-[#ff2e9a] bg-clip-text text-transparent",
          )}
        >
          {won ? "Bridge cleared" : "The glass gave way"}
        </h2>

        <p className="relative mt-2 max-w-[42ch] text-[12.5px] leading-relaxed text-white/45">
          {won
            ? `You crossed all ${result.stages} stages without a single misstep. The far platform is yours.`
            : `You reached stage ${reached} of ${result.stages}. The next pane could not hold — the void is patient.`}
        </p>

        {result.isBest && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-[#ffb020]/35 bg-[#ffb020]/10 px-3 py-1.5 text-[10px] font-heading uppercase tracking-[0.2em] text-[#ffd77a]"
          >
            <Crown className="h-3 w-3" /> New personal best
          </motion.div>
        )}

        <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Stages" value={`${result.stagesCompleted}/${result.stages}`} accent />
          <Stat label="Time" value={formatDuration(result.durationMs)} />
          <Stat label="Attempts" value={stats?.runs ?? 0} />
          <Stat label="Best" value={`${stats?.best ?? 0}`} />
        </div>

        {!won && (
          <div className="relative mt-4 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-[11px] leading-snug text-white/35">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff2e9a]/70" />
            <span>
              Each bridge is generated fresh — no pattern carries over from the last run.
            </span>
          </div>
        )}

        <div className="relative mt-6 flex flex-col gap-2 sm:flex-row">
          <NeonButton
            variant={won ? "lime" : "pink"}
            size="md"
            icon={RotateCcw}
            onClick={onRestart}
            className="w-full sm:flex-1"
          >
            Run again
          </NeonButton>
          <NeonButton variant="glass" size="md" icon={Home} onClick={onMenu} className="w-full sm:flex-1">
            Main menu
          </NeonButton>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        accent ? "border-[#b6ff3c]/25 bg-[#b6ff3c]/[0.06]" : "border-white/[0.08] bg-white/[0.03]",
      )}
    >
      <div
        className={cn(
          "font-heading text-base font-bold leading-none tabular-nums",
          accent ? "text-[#d9ff9a]" : "text-white/85",
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[8.5px] uppercase tracking-[0.2em] text-white/30">{label}</div>
    </div>
  );
}