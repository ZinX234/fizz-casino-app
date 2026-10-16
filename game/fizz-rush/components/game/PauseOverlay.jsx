import { Play, RotateCcw, Home, Volume2, VolumeX, Gauge } from 'lucide-react';
import { GAME_CONFIG } from '@/game/fizz-rush/game/config';
import { settingsStore, useSettings } from '@/game/fizz-rush/game/settings';
import { cn } from '@/lib/utils';

/** Pause menu with quick audio and graphics controls. */
export default function PauseOverlay({ onResume, onRestart, onQuit, canRestart }) {
  const settings = useSettings();
  const muted = settings.audio.muted;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="glass-strong w-full max-w-md rounded-3xl p-6">
        <h2 className="font-heading text-2xl font-bold tracking-tight">Paused</h2>
        <p className="mt-1 text-xs text-muted-foreground">The island waits. Take your time.</p>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={onResume}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ffe08a] to-[#e0a52c] px-5 py-3 font-heading text-sm font-bold text-[#3a2604]"
          >
            <Play className="h-4 w-4 fill-current" /> Resume run
          </button>
          <button
            type="button"
            onClick={onRestart}
            disabled={!canRestart}
            className={cn(
              'flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-heading text-sm font-semibold',
              !canRestart && 'cursor-not-allowed opacity-50'
            )}
          >
            <RotateCcw className="h-4 w-4" /> Restart (re-stakes your wager)
          </button>
          <button
            type="button"
            onClick={onQuit}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-heading text-sm font-semibold"
          >
            <Home className="h-4 w-4" /> Leave the island
          </button>
        </div>

        <div className="mt-5 grid gap-3 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <span className="label-xs">Audio</span>
            <button
              type="button"
              onClick={() => settingsStore.patchAudio({ muted: !muted })}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold"
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              {muted ? 'Muted' : 'Sound on'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="label-xs flex items-center gap-1.5">
              <Gauge className="h-3 w-3" /> Graphics
            </span>
            <div className="flex gap-1.5">
              {GAME_CONFIG.graphics.presetOrder.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => settingsStore.setQuality(id)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-[11px] font-semibold capitalize',
                    settings.quality === id ? 'border-primary/50 bg-primary/20 text-primary' : 'border-white/10 text-muted-foreground'
                  )}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}