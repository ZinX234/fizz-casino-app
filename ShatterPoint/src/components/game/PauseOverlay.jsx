import { Pause, Play, RotateCcw, Settings, LogOut } from "lucide-react";
import NeonButton from "@/components/game/ui/NeonButton";
import FizzMark from "@/components/game/FizzMark";

export default function PauseOverlay({ open, onResume, onRestart, onSettings, onExit, stage, stages, mode }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="glass-panel w-full max-w-[380px] rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <FizzMark />
          <Pause className="h-4 w-4 text-white/30" />
        </div>
        <h2 className="mt-5 font-heading text-2xl font-bold uppercase tracking-[0.08em] text-white">
          Paused
        </h2>
        <p className="mt-1 text-[11.5px] text-white/40">
          Stage {Math.min(stage + 1, stages)} of {stages} · {mode === "real" ? "Real play" : "Demo mode"}
        </p>
        <div className="mt-5 space-y-2">
          <NeonButton variant="lime" size="md" icon={Play} onClick={onResume} className="w-full">
            Resume
          </NeonButton>
          <NeonButton variant="glass" size="md" icon={RotateCcw} onClick={onRestart} className="w-full">
            Restart run
          </NeonButton>
          <NeonButton variant="glass" size="md" icon={Settings} onClick={onSettings} className="w-full">
            Settings
          </NeonButton>
          <NeonButton variant="ghost" size="md" icon={LogOut} onClick={onExit} className="w-full">
            Exit to menu
          </NeonButton>
        </div>
      </div>
    </div>
  );
}