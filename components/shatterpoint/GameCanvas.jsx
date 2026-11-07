"use client";

import { useEffect, useRef } from "react";
import { ShatterScene } from "@/game/shatterpoint/scene/ShatterScene";

export default function GameCanvas({ settings, theme, stages, callbacks, onReady, onError }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let disposed = false;
    try {
      const scene = new ShatterScene(container, { settings, theme, stages, ...callbacks });
      sceneRef.current = scene;
      scene.init();
      onReady?.(scene);
    } catch (error) {
      if (!disposed) onError?.(error instanceof Error ? error : new Error("WebGL could not start"));
    }

    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setTheme(theme);
    sceneRef.current?.setSettings(settings);
    sceneRef.current?.enableStage?.(0);
  }, [theme, settings]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
