import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GameCanvas from "@/components/game/GameCanvas";
import MenuBackdrop from "@/components/game/MenuBackdrop";
import MainMenu from "@/components/game/MainMenu";
import GameHUD from "@/components/game/GameHUD";
import ResultsScreen from "@/components/game/ResultsScreen";
import IntroOverlay from "@/components/game/IntroOverlay";
import SettingsDialog from "@/components/game/SettingsDialog";
import HowToPlayDialog from "@/components/game/HowToPlayDialog";
import RealPlayDialog from "@/components/game/RealPlayDialog";
import PauseOverlay from "@/components/game/PauseOverlay";
import { audio } from "@/game/audio";
import { createSession, isSafePanel, mergeStats, sessionSummary } from "@/game/engine";
import {
  DEFAULT_DEV,
  DEFAULT_SETTINGS,
  DEFAULT_STATS,
  INTRO_KEY,
  clampStages,
  loadDev,
  loadSettings,
  loadStats,
  readJSON,
  saveSettings,
  saveStats,
  writeJSON,
} from "@/game/settings";
import { beginRealPlay, completeRealPlay, getBalance, submitStep, cashOut } from "@/game/fizzBridge";

export default function ShatterpointGame({ embedded }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [dev, setDev] = useState(DEFAULT_DEV);
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [balance, setBalance] = useState({ available: 0, currency: "FC", connected: false });
  const [balanceChecking, setBalanceChecking] = useState(false);
  const [screen, setScreen] = useState("menu");
  const [session, setSession] = useState(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneError, setSceneError] = useState(null);

  const sceneRef = useRef(null);
  const sessionRef = useRef(null);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const devRef = useRef(DEFAULT_DEV);
  const statsRef = useRef(DEFAULT_STATS);
  const screenRef = useRef("menu");
  screenRef.current = screen;

  const stages = clampStages(dev.stages);

  const sceneSettings = useMemo(
    () => ({
      ...settings,
      cameraSpeed: dev.cameraSpeed,
      animation: settings.reducedMotion
        ? "minimal"
        : dev.animationQuality === "high"
          ? settings.animation
          : dev.animationQuality === "medium"
            ? "subtle"
            : "minimal",
    }),
    [settings, dev.cameraSpeed, dev.animationQuality],
  );

  const refreshBalance = useCallback(async () => {
    setBalanceChecking(true);
    const b = await getBalance();
    setBalance(b);
    setBalanceChecking(false);
    return b;
  }, []);

  // ── boot: preferences, intro, audio unlock ────────────────────────────────
  useEffect(() => {
    const s = loadSettings();
    const d = loadDev();
    const st = loadStats();
    settingsRef.current = s;
    devRef.current = d;
    statsRef.current = st;
    setSettings(s);
    setDev(d);
    setStats(st);
    audio.applySettings(s);
    refreshBalance();
    const introSeen = readJSON(INTRO_KEY, { seen: false });
    if (!s.skipIntro && !introSeen.seen) setIntroOpen(true);
  }, [refreshBalance]);

  useEffect(() => {
    const unlock = () => {
      audio.unlock();
      audio.applySettings(settingsRef.current);
      if (!audio.ambience) audio.startAmbience();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // ── run clock ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "game" || !session) return;
    const id = window.setInterval(() => setElapsedMs(Date.now() - session.startedAt), 250);
    return () => window.clearInterval(id);
  }, [screen, session]);

  const handleSceneReady = useCallback((scene) => {
    sceneRef.current = scene;
    scene.setTheme(devRef.current.theme);
    scene.enterMenu(clampStages(devRef.current.stages));
    setSceneReady(true);
  }, []);

  // ── preferences ──────────────────────────────────────────────────────────
  const updateSettings = useCallback((patch) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
    audio.applySettings(next);
  }, []);

  /** Cash out of the current real-money session.
   *  Commits the result to the server, credits balance, and shows results screen.
   */
  const handleCashOut = useCallback(async () => {
    if (!session || session.status !== "playing" || session.locked) return;
    const cashOutRes = await cashOut({
      sessionId: session.id,
      configVersion: session.configVersion,
      seed: session.seed,
    });
    if (!cashOutRes.ok) return;
    // Credit balance
    const newBalance = (balance.available || 0) + (cashOutRes.winnings || 0);
    setBalance({ available: newBalance, currency: "FC", connected: true });
    setResult({
      mode: session.mode,
      status: "cashout",
      stages: session.stages,
      stagesCompleted: session.stage,
      winnings: cashOutRes.winnings,
      durationMs: Date.now() - (session.startedAt || Date.now()),
    });
    setScreen("results");
  }, [session, balance, cashOut]);

  // ── run lifecycle ────────────────────────────────────────────────────────
  const startRun = useCallback(async (mode) => {
    audio.unlock();
    audio.applySettings(settingsRef.current);
    if (!audio.ambience) audio.startAmbience();
    const s = createSession({ mode, stages: clampStages(devRef.current.stages) });
    sessionRef.current = s;
    setSession({ ...s });
    setStageIndex(0);
    setElapsedMs(0);
    setResult(null);
    setDialog(null);
    setPauseOpen(false);
    setLocked(true);
    setScreen("game");
    audio.play("whoosh");
    await new Promise((resolve) => window.setTimeout(resolve, 40));
    if (sceneRef.current) await sceneRef.current.startRun({ stages: s.stages });
    setLocked(false);
  }, []);

  const finishRun = useCallback((s) => {
    const summary = sessionSummary(s, Date.now());
    const prev = statsRef.current;
    const next = mergeStats(prev, summary);
    statsRef.current = next;
    setStats(next);
    saveStats(next);
    setElapsedMs(summary.durationMs);
    setResult({ ...summary, isBest: summary.stagesCompleted > (prev.best || 0) });
    if (s.mode === "real") completeRealPlay(summary);
    window.setTimeout(() => {
      setScreen("results");
      setLocked(true);
    }, 520);
  }, []);

  const handlePick = useCallback(
    async (side) => {
      if (screenRef.current !== "game") return;
      const s = sessionRef.current;
      const scene = sceneRef.current;
      if (!s || !scene || s.status !== "playing" || s.locked) return;

      // Submit step server-side for authoritative outcome determination
      s.locked = true;
      setLocked(true);
      audio.play("select");

      const stepRes = await submitStep({
        sessionId: s.id,
        stage: s.stage,
        side,
        stake: s.stakedAmount || 0,
        configVersion: s.configVersion,
        seed: s.seed,
      });

      if (!stepRes.ok) {
        // Server error - reset and abort
        s.locked = false;
        setLocked(false);
        return;
      }

      // Server has committed the outcome - animate accordingly
      if (stepRes.safe) {
        // Safe pane - advance stage
        await scene.resolveSafe(stepRes.stage, stepRes.side);
        audio.play("safe");
        s.stage = stepRes.nextStage;
        setStageIndex(s.stage);
        if (s.stage >= s.stages) {
          s.status = "victory";
          await scene.playVictory();
          audio.play("victory");
          finishRun(s);
        } else {
          s.stage = stepRes.nextStage;
          setStageIndex(s.stage);
          s.locked = false;
          setLocked(false);
          if (sceneRef.current) {
            sceneRef.current.enableStage(s.stage);
          }
        }
      } else {
        // Unsafe pane - run ends
        s.status = "failed";
        await scene.breakPanel(stepRes.stage, stepRes.side, {
          onCrack: () => audio.play("crack"),
          onShatter: () => {
            audio.play("shatter");
            audio.play("fall");
          },
        });
        audio.play("defeat");
        finishRun(s);
      }
    },
    [sessionRef, sceneRef, sceneReady, finishRun],
  );

  const exitToMenu = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
    setResult(null);
    setStageIndex(0);
    setElapsedMs(0);
    setLocked(false);
    setPauseOpen(false);
    setDialog(null);
    setScreen("menu");
    sceneRef.current?.enterMenu(clampStages(devRef.current.stages));
    audio.play("ui");
    refreshBalance();
  }, [refreshBalance]);

  const restartRun = useCallback(() => {
    const mode = sessionRef.current?.mode || "demo";
    startRun(mode);
  }, [startRun]);

  const handleDemo = useCallback(() => {
    if (!devRef.current.demoEnabled) return;
    audio.play("ui");
    startRun("demo");
  }, [startRun]);

  const handleRealPlay = useCallback(async () => {
    audio.unlock();
    audio.play("ui");
    const b = await refreshBalance();
    if (b.available > 0) {
      const entry = await beginRealPlay({ mode: "real" });
      if (entry?.allowed !== false) {
        startRun("real");
        return;
      }
    }
    setDialog("realplay");
  }, [refreshBalance, startRun]);

  const toggleSound = useCallback(() => {
    updateSettings({ muted: !settingsRef.current.muted });
  }, [updateSettings]);

  const dismissIntro = useCallback(() => {
    writeJSON(INTRO_KEY, { seen: true });
    setIntroOpen(false);
    audio.unlock();
    audio.applySettings(settingsRef.current);
    if (!audio.ambience) audio.startAmbience();
    audio.play("whoosh");
  }, []);

  // ── keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (screenRef.current !== "game") return;
      if (pauseOpen || dialog) return;
      const key = e.key.toLowerCase();
      if (key === "a" || e.key === "ArrowLeft") {
        e.preventDefault();
        handlePick("left");
      } else if (key === "d" || e.key === "ArrowRight") {
        e.preventDefault();
        handlePick("right");
      } else if (e.key === "Escape") {
        setPauseOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, handlePick, pauseOpen]);

  const callbacks = useMemo(
    () => ({
      onPick: handlePick,
      onHover: (hit) => {
        if (hit) audio.play("hover");
      },
      onStep: () => audio.play("step"),
    }),
    [handlePick],
  );

  return (
    <div
      className="relative w-full overflow-hidden bg-[#04050a] text-white"
      style={{
        height: embedded ? "h-full" : "h-[100svh]",
      }}
    >
      <MenuBackdrop />
      <div className="absolute inset-0 z-0">
        <GameCanvas
          settings={sceneSettings}
          theme={dev.theme}
          stages={stages}
          callbacks={callbacks}
          onReady={handleSceneReady}
          onError={setSceneError}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_50%_42%,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

      {screen === "menu" && (
        <div className="absolute inset-0 z-10 overflow-y-auto">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,5,10,0.72),rgba(4,5,10,0.32)_42%,rgba(4,5,10,0.82))]" />
          <div className="relative">
            <MainMenu
              onDemo={handleDemo}
              onRealPlay={handleRealPlay}
              onHowTo={() => {
                audio.play("ui");
                setDialog("howto");
              }}
              onSettings={() => {
                audio.play("ui");
                setDialog("settings");
              }}
              muted={settings.muted}
              onToggleSound={toggleSound}
              stats={stats}
              stageCount={stages}
              realBalance={balance.available}
              demoEnabled={dev.demoEnabled && sceneReady}
              ready={sceneReady}
            />
          </div>
        </div>
      )}

      {screen === "game" && (
        <>
          <GameHUD
            mode={session?.mode || "demo"}
            stages={session?.stages || stages}
            stageIndex={stageIndex}
            elapsedMs={elapsedMs}
            locked={locked}
            muted={settings.muted}
            onPick={handlePick}
            onToggleSound={toggleSound}
            onSettings={() => {
              audio.play("ui");
              setPauseOpen(false);
              setDialog("settings");
            }}
            onPause={() => {
              audio.play("ui");
              setPauseOpen(true);
            }}
            onRestart={restartRun}
              onCashOut={handleCashOut}
            />
            <PauseOverlay
            open={pauseOpen}
            stage={stageIndex}
            stages={session?.stages || stages}
            mode={session?.mode || "demo"}
            onResume={() => setPauseOpen(false)}
            onRestart={restartRun}
            onSettings={() => {
              setPauseOpen(false);
              setDialog("settings");
            }}
            onExit={exitToMenu}
          />
        </>
      )}

      {screen === "results" && result && (
        <ResultsScreen result={result} stats={stats} onRestart={restartRun} onMenu={exitToMenu} />
      )}

      <SettingsDialog
        open={dialog === "settings"}
        onOpenChange={(v) => !v && setDialog(null)}
        settings={settings}
        onChange={updateSettings}
        onReplayIntro={() => {
          setDialog(null);
          setIntroOpen(true);
        }}
      />
      <HowToPlayDialog
        open={dialog === "howto"}
        onOpenChange={(v) => !v && setDialog(null)}
        stages={stages}
      />
      <RealPlayDialog
        open={dialog === "realplay"}
        onOpenChange={(v) => !v && setDialog(null)}
        balance={balance}
        checking={balanceChecking}
        onRecheck={refreshBalance}
      />
      {introOpen && !sceneError && <IntroOverlay onDone={dismissIntro} />}

      {sceneError && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#04050a] p-6 text-center">
          <div className="max-w-sm">
            <h2 className="font-heading text-xl font-bold uppercase tracking-[0.1em] text-white">
              3D arena unavailable
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-white/45">
              This device or browser could not start the WebGL renderer. Try a different browser, or
              enable hardware acceleration, then reload the page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}