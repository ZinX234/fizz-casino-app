import { clampStages } from "@/game/shatterpoint/settings";

export function createSession({ mode, stages }) {
  const total = clampStages(stages);
  return {
    id: `sp_${Date.now().toString(36)}`,
    mode: mode === "real" ? "real" : "demo",
    stages: total,
    stage: 0,
    status: "playing", // playing | victory | failed
    locked: false,
    startedAt: Date.now(),
  };
}

export function isSafePanel(session, stage, side) {
  return false;
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