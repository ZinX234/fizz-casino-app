"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import GameCanvas from "@/components/shatterpoint/GameCanvas";
import { formatFizzcoins } from "@/lib/format-money";

const DEFAULT_STAGE_COUNT = 12;

export default function ShatterpointGame({ embedded = false, initialMode = "real", initialBalance = 0, setting, initialRound }) {
  const [mode, setMode] = useState(initialMode === "demo" ? "demo" : "real");
  const [phase, setPhase] = useState("menu");
  const [sessionId, setSessionId] = useState(null);
  const [stageCount, setStageCount] = useState(DEFAULT_STAGE_COUNT);
  const [stage, setStage] = useState(0);
  const [locked, setLocked] = useState(false);
  const [stake, setStake] = useState(() => {
    const configuredMin = Number(setting?.minBetCents ?? 100) / 100;
    return configuredMin.toFixed(2);
  });
  const [balance, setBalance] = useState(Math.max(0, Math.floor((Number(initialBalance) || 0) * 400)));
  const [ladder, setLadder] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneError, setSceneError] = useState(null);
  const sceneRef = useRef(null);

  const minStake = Number(setting?.minBetCents ?? 100) / 100;
  const maxStake = Number(setting?.maxBetCents ?? 75000) / 100;

  useEffect(() => {
    setStake((current) => {
      const numeric = Number(current);
      const bounded = Number.isFinite(numeric)
        ? Math.min(maxStake, Math.max(minStake, numeric))
        : minStake;
      return bounded.toFixed(2);
    });
  }, [minStake, maxStake]);

  useEffect(() => {
    if (mode !== "real" || !initialRound?.shatterpoint) return;
    setSessionId(initialRound.sessionId);
    setStage(initialRound.shatterpoint.currentStage ?? 0);
    setStageCount(initialRound.shatterpoint.stageCount ?? DEFAULT_STAGE_COUNT);
    setLadder(initialRound.shatterpoint.ladder ?? []);
    if (initialRound.status === "active") {
      setPhase("game");
    }
  }, [initialRound, mode]);

  useEffect(() => {
    if (!sceneReady || mode !== "real" || initialRound?.status !== "active" || !initialRound?.shatterpoint) return;
    sceneRef.current?.startRun({ stages: initialRound.shatterpoint.stageCount ?? DEFAULT_STAGE_COUNT });
  }, [sceneReady, initialRound, mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("fizz:game-launch", { detail: { slug: "shatterpoint", mode } }));
    track("shatterpoint_launch", { mode });
    return () => window.dispatchEvent(new CustomEvent("fizz:game-exit", { detail: { slug: "shatterpoint" } }));
  }, []);

  const syncWallet = useCallback((wallet) => {
    if (!wallet || wallet.balance === null || wallet.balance === undefined) return;
    const next = Number(wallet.balance);
    if (!Number.isFinite(next) || next < 0) return;
    const nextFizzcoins = Math.max(0, Math.floor(next * 400));
    setBalance(nextFizzcoins);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("fizz:wallet-sync", { detail: { balance: next } }));
    }
  }, []);

  const refreshWallet = useCallback(async () => {
    try {
      const response = await fetch(`/api/account/wallet?ts=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "x-requested-with": "XMLHttpRequest" },
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.wallet) syncWallet(data.wallet);
      return data?.wallet ? Math.max(0, Math.floor(Number(data.wallet.balance) * 400)) : null;
    } catch {
      // Keep the last successfully read wallet value rather than guessing.
      return null;
    }
  }, [syncWallet]);

  useEffect(() => {
    if (mode !== "real") return;
    refreshWallet();
    const interval = window.setInterval(refreshWallet, 5000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshWallet();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [mode, refreshWallet]);

  const startRound = async (selectedMode = mode) => {
    setError("");
    setResult(null);
    if (selectedMode === "demo") {
      const id = `demo-${Date.now()}`;
      setMode("demo");
      setSessionId(id);
      setStage(0);
      setPhase("game");
      setLocked(false);
      setLadder(Array.from({ length: stageCount }, (_, i) => Number((1 + (i + 1) * 0.25).toFixed(2))));
      sceneRef.current?.startRun({ stages: stageCount });
      track("shatterpoint_round_start", { mode: "demo", stageCount });
      return;
    }

    const stakeNumber = Number(stake);
    if (!Number.isFinite(stakeNumber) || stakeNumber < minStake || stakeNumber > maxStake) {
      setError(`Stake must be between ${minStake.toFixed(0)} and ${maxStake.toFixed(0)} Fizzcoins.`);
      return;
    }

    setLocked(true);
    const requestId = crypto.randomUUID();
    try {
      const authoritativeBalance = await refreshWallet();
      if (authoritativeBalance !== null && stakeNumber > authoritativeBalance) {
        throw new Error(`Insufficient balance. You have ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(authoritativeBalance)} Fizzcoins available.`);
      }
      const response = await fetch("/api/games/shatterpoint/play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "start",
          requestId,
          wagerCents: Math.round(stakeNumber / 4),
          stageCount,
          expectedRtpBps: setting?.rtpBps ?? 9800,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start the round.");
      const round = data.round;
      setMode("real");
      setSessionId(round.sessionId);
      setStage(round.shatterpoint?.currentStage ?? 0);
      setLadder(round.shatterpoint?.ladder ?? []);
      syncWallet(data.wallet);
      setPhase("game");
      await sceneRef.current?.startRun({ stages: round.shatterpoint?.stageCount ?? stageCount });
      window.dispatchEvent(new CustomEvent("fizz:game-run", { detail: { slug: "shatterpoint", mode: "real", sessionId: round.sessionId } }));
      track("shatterpoint_round_start", { mode: "real", stageCount: round.shatterpoint?.stageCount ?? stageCount });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the round.");
      setPhase("menu");
    } finally {
      setLocked(false);
    }
  };

  const handlePick = useCallback(async (side) => {
    if (locked || phase !== "game" || !sceneRef.current) return;
    setLocked(true);
    setError("");

    try {
      let step;
      if (mode === "demo") {
        const pickedSide = Math.random() < 0.5 ? "left" : "right";
        const safe = side === pickedSide;
        step = {
          safe,
          stage,
          side,
          nextStage: safe ? stage + 1 : stage,
          multiplier: safe ? Number((1 + (stage + 1) * 0.25).toFixed(2)) : 0,
        };
      } else {
        const response = await fetch("/api/games/shatterpoint/play", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "pick", sessionId, stage, side, requestId: crypto.randomUUID() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "The step could not be submitted.");
        syncWallet(data.wallet);
        const authoritativeStep = data.round.shatterpoint?.lastStep;
        step = {
          safe: authoritativeStep
            ? authoritativeStep.safe
            : data.round.result !== "loss" && data.round.shatterpoint?.currentStage > stage,
          stage: authoritativeStep?.stage ?? stage,
          side,
          nextStage: authoritativeStep?.nextStage ?? data.round.shatterpoint?.currentStage ?? stage,
          settlement: data.round,
        };
      }

      await new Promise((resolve) => window.setTimeout(resolve, 120));
      if (step.safe) {
        await sceneRef.current.resolveSafe(step.stage, side);
        const nextStage = step.nextStage;
        setStage(nextStage);
        sceneRef.current.enableStage?.(nextStage);
        if (nextStage >= stageCount) {
          if (mode === "demo") {
            setResult({ status: "win", payout: Number(stake) * (ladder[stageCount - 1] || 1) });
          } else {
            setResult({
              status: step.settlement.result === "win" ? "win" : "active",
              payout: Math.round((Number(step.settlement.payout) || 0) * 400),
            });
            setSessionId(null);
          }
          await sceneRef.current.playVictory?.();
          track("shatterpoint_round_complete", { mode, result: "win", stage: nextStage });
          setPhase("results");
        }
      } else {
        await sceneRef.current.breakPanel(step.stage, side, {});
        setResult({ status: "loss", payout: 0 });
        if (mode === "real") {
          await refreshWallet();
          setSessionId(null);
        }
        track("shatterpoint_round_complete", { mode, result: "loss", stage });
        setPhase("results");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The step could not be submitted.");
    } finally {
      setLocked(false);
    }
  }, [locked, mode, phase, sessionId, stage, stageCount, stake, refreshWallet]);

  const cashOut = async () => {
    if (locked || phase !== "game" || stage < 1) return;
    setLocked(true);
    setError("");
    try {
      if (mode === "demo") {
        setResult({ status: "cashout", payout: Number(stake) * (ladder[stage - 1] || 1) });
        setPhase("results");
        track("shatterpoint_round_complete", { mode: "demo", result: "cashout", stage });
        return;
      }
      const response = await fetch("/api/games/shatterpoint/play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "cashout", sessionId, requestId: crypto.randomUUID() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cash out failed.");
      syncWallet(data.wallet);
      setResult({ status: "cashout", payout: Math.round((Number(data.round.payout) || 0) * 400) });
      setSessionId(null);
      setPhase("results");
      track("shatterpoint_round_complete", { mode: "real", result: "cashout", stage });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cash out failed.");
    } finally {
      setLocked(false);
    }
  };

  const forfeitRound = useCallback(async () => {
    if (mode !== "real" || !sessionId) return;
    const roundToForfeit = sessionId;
    try {
      await fetch("/api/games/shatterpoint/play", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "forfeit",
          sessionId: roundToForfeit,
          requestId: crypto.randomUUID(),
        }),
      });
      await refreshWallet();
    } catch {
      // Navigation may still proceed; the server round remains bounded and expires automatically.
    } finally {
      setSessionId(null);
    }
  }, [mode, sessionId, refreshWallet]);

  const exit = async () => {
    await forfeitRound();
    sceneRef.current?.enterMenu?.(stageCount);
    setPhase("menu");
    setSessionId(null);
    setStage(0);
    setResult(null);
  };

  useEffect(() => {
    if (mode !== "real" || !sessionId) return undefined;
    const handlePageHide = () => {
      const roundToForfeit = sessionId;
      const body = new Blob([JSON.stringify({
        action: "forfeit",
        sessionId: roundToForfeit,
        requestId: crypto.randomUUID(),
      })], { type: "application/json" });
      navigator.sendBeacon("/api/games/shatterpoint/play", body);
    };
    const handleLeave = () => handlePageHide();
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("fizz:shatterpoint-leave", handleLeave);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("fizz:shatterpoint-leave", handleLeave);
    };
  }, [mode, sessionId]);

  return (
    <div className={`relative w-full overflow-hidden bg-[#04050a] text-white ${embedded ? "h-full" : "min-h-[100svh]"}`}>
      <div className="absolute inset-0">
        <GameCanvas
          settings={{ muted: false, graphics: "high" }}
          theme="neon"
          stages={stageCount}
          callbacks={{ onPick: handlePick }}
          onReady={(scene) => { sceneRef.current = scene; scene.enterMenu(stageCount); setSceneReady(true); }}
          onError={setSceneError}
        />
      </div>

      {phase === "menu" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#080a10]/95 p-6 shadow-2xl backdrop-blur-xl">
            {!embedded && <div className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-lime-300">FIZZ: Shatterpoint</div>}
            <h1 className="text-2xl font-black uppercase tracking-wide">Glass bridge</h1>
            <p className="mt-2 text-sm text-white/55">Cross each stage. Cash out when your ladder reaches a payout you want.</p>
            <label className="mt-5 block text-xs uppercase tracking-widest text-white/50">Bridge stages</label>
            <input type="range" min={3} max={24} value={stageCount} onChange={(event) => setStageCount(Number(event.target.value))} className="mt-2 w-full accent-lime-300" />
            <div className="mt-1 text-right text-sm font-bold">{stageCount}</div>
            <label className="mt-4 block text-xs uppercase tracking-widest text-white/50">Stake (Fizzcoins)</label>
            <input type="number" min={minStake} max={maxStake} step="0.01" value={stake} onChange={(event) => setStake(event.target.value)} disabled={mode === "demo"} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 text-white outline-none focus:border-lime-300/60" />
            <div className="mt-3 text-xs text-white/45">Balance: {formatFizzcoins((balance / 400).toFixed(2), "USD")}</div>
            {error && <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setMode("demo"); startRound("demo"); }} disabled={!sceneReady} className="h-12 rounded-lg border border-white/15 bg-white/[0.06] font-bold uppercase">Demo</button>
              <button type="button" onClick={() => { setMode("real"); startRound("real"); }} disabled={locked || !sceneReady} className="h-12 rounded-lg bg-lime-300 font-black uppercase text-black">Play real</button>
            </div>
          </div>
        </div>
      )}

      {phase === "game" && (
        <div className="absolute inset-x-0 bottom-0 z-20 p-3 sm:top-3 sm:bottom-auto">
          <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/75 p-2 backdrop-blur-lg">
            <div className="text-xs"><span className="text-white/45">Stage</span> <strong>{stage} / {stageCount}</strong></div>
            <div className="text-xs"><span className="text-white/45">Balance</span> <strong>{formatFizzcoins((balance / 400).toFixed(2), "USD")}</strong></div>
            {stage >= 1 && (
              <button type="button" onClick={cashOut} disabled={locked} className="rounded-lg bg-lime-300 px-4 py-2 text-sm font-black text-black disabled:opacity-50">
                Cash out {ladder[stage - 1] ? `${ladder[stage - 1]}x` : ""}
              </button>
            )}
            <button type="button" onClick={() => handlePick("left")} disabled={locked} className="rounded-lg border border-white/15 px-4 py-2 text-sm">Left</button>
            <button type="button" onClick={() => handlePick("right")} disabled={locked} className="rounded-lg border border-white/15 px-4 py-2 text-sm">Right</button>
          </div>
        </div>
      )}

      {phase === "results" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#090b11] p-6 text-center">
            <div className="text-xs uppercase tracking-widest text-white/45">{result?.status === "loss" ? "Bridge broken" : "Round complete"}</div>
            <div className="mt-2 text-3xl font-black">{new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(result?.payout || 0)))} Fizzcoins</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={exit} className="h-11 rounded-lg border border-white/15">Exit</button>
              <button type="button" onClick={() => startRound(mode)} className="h-11 rounded-lg bg-lime-300 font-black text-black">Again</button>
            </div>
          </div>
        </div>
      )}

      {error && phase === "game" && <div className="absolute left-1/2 top-20 z-40 -translate-x-1/2 rounded-lg bg-red-950 px-4 py-3 text-sm text-red-100">{error}</div>}
      {sceneError && <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#04050a] p-6 text-center">This device could not start the WebGL renderer.</div>}
    </div>
  );
}
