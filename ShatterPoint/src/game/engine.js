import { clampStages } from "@/game/settings";

/**
 * Pure game logic. The bridge layout is generated once per session and never
 * re-rolled, so an outcome can never change after a player has committed.
 */

/**
 * Which pane is stable. A plain fair coin: no RTP, no house edge, no weighting
 * of any kind is applied in this build. When the game goes live on the site,
 * this one function is the only place that logic needs to be added.
 */
export function stableSide() {
  return Math.random() < 0.5 ? "left" : "right";
}

export function generateArrangement(stages) {
  const total = clampStages(stages);
  return Array.from({ length: total }, () => stableSide());
}

export function createSession({ mode, stages }) {
  const total = clampStages(stages);
  return {
    id: `sp_${Date.now().toString(36)}`,
    mode: mode === "real" ? "real" : "demo",
    stages: total,
    arrangement: generateArrangement(total),
    stage: 0,
    status: "playing", // playing | victory | failed
    locked: false,
    startedAt: Date.now(),
  };
}

export function isSafePanel(session, stage, side) {
  if (!session || !session.arrangement) return false;
  return session.arrangement[stage] === side;
}

export function completedStages(session) {
  if (!session) return 0;
  return session.status === "victory" ? session.stages : session.stage;
}

export function sessionSummary(session, endedAt) {
  const stagesCompleted = completedStages(session);
  const durationMs = Math.max(0, (endedAt || Date.now()) - (session?.startedAt || Date.now()));
  return {
    mode: session?.mode || "demo",
    status: session?.status || "failed",
    stages: session?.stages || 0,
    stagesCompleted,
    durationMs,
    reachedStage: Math.min(stagesCompleted + (session?.status === "victory" ? 0 : 1), session?.stages || 0),
  };
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function mergeStats(stats, summary) {
  return {
    best: Math.max(stats.best || 0, summary.stagesCompleted),
    runs: (stats.runs || 0) + 1,
    wins: (stats.wins || 0) + (summary.status === "victory" ? 1 : 0),
    totalStages: (stats.totalStages || 0) + summary.stagesCompleted,
  };
}