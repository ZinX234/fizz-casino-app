import { useMemo } from "react";

// Atmospheric CSS backdrop used behind the 3D scene (and while it loads).
export default function MenuBackdrop() {
  const shards = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: `${(i * 7.3 + 4) % 96}%`,
        top: `${(i * 13.7 + 12) % 88}%`,
        size: 8 + ((i * 5) % 26),
        delay: (i * 1.37) % 9,
        duration: 9 + ((i * 2.1) % 7),
        dx: `${((i % 2 === 0 ? 1 : -1) * (12 + (i % 5) * 8)).toFixed(0)}px`,
        dy: `-${100 + (i % 6) * 20}px`,
        dr: `${(i % 2 === 0 ? 1 : -1) * (20 + i * 6)}deg`,
        hue: i % 3,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* deep void base */}
      <div className="absolute inset-0 bg-[#05060a]" />

      {/* horizon bloom */}
      <div className="absolute inset-x-0 top-[42%] h-[46vh] bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,46,154,0.16),transparent_62%)] blur-2xl" />
      <div className="absolute inset-x-0 bottom-[-18%] h-[55vh] bg-[radial-gradient(ellipse_at_50%_50%,rgba(182,255,60,0.20),transparent_60%)] blur-3xl" />
      <div className="absolute left-[-10%] top-[8%] h-[38vh] w-[46vw] rounded-full bg-[radial-gradient(circle,rgba(120,60,255,0.14),transparent_65%)] blur-3xl" />
      <div className="absolute right-[-12%] top-[22%] h-[34vh] w-[42vw] rounded-full bg-[radial-gradient(circle,rgba(255,122,24,0.13),transparent_65%)] blur-3xl" />

      {/* perspective bridge floor */}
      <div className="perspective-far absolute inset-x-0 bottom-0 h-[62vh] overflow-hidden">
        <div
          className="absolute inset-x-[-40%] bottom-[-6%] top-0 origin-bottom"
          style={{
            transform: "rotateX(70deg)",
            backgroundImage:
              "linear-gradient(to right, rgba(182,255,60,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse at 50% 0%, black 0%, rgba(0,0,0,0.65) 42%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 50% 0%, black 0%, rgba(0,0,0,0.65) 42%, transparent 78%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#05060a] via-[#05060a]/80 to-transparent" />
      </div>

      {/* floating glass shards */}
      {shards.map((s) => (
        <span
          key={s.id}
          className="absolute block animate-[fz-float-shard_var(--dur)_linear_infinite] border border-white/25"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size * 1.5,
            borderRadius: 2,
            transform: "rotate(24deg)",
            background:
              s.hue === 0
                ? "linear-gradient(135deg, rgba(182,255,60,0.30), rgba(255,255,255,0.04))"
                : s.hue === 1
                  ? "linear-gradient(135deg, rgba(255,46,154,0.28), rgba(255,255,255,0.03))"
                  : "linear-gradient(135deg, rgba(255,255,255,0.20), rgba(255,255,255,0.02))",
            boxShadow:
              s.hue === 0
                ? "0 0 14px rgba(182,255,60,0.28)"
                : s.hue === 1
                  ? "0 0 14px rgba(255,46,154,0.24)"
                  : "none",
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            "--dx": s.dx,
            "--dy": s.dy,
            "--dr": s.dr,
          }}
        />
      ))}

      {/* vignette + grain */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_25%,rgba(0,0,0,0.72)_100%)]" />
      <div className="scanlines absolute inset-0 opacity-40" />
    </div>
  );
}