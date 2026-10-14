import React from 'react';

// Gooey is Good: a stream of slime sweeps the reels and leaves wilds behind.
function Splat() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <g stroke="#151515" strokeWidth="5" strokeLinejoin="round">
        <path d="M50 12 q18 0 24 16 q16 2 14 18 q-2 12 -16 14 q-2 20 -22 20 q-20 0 -22 -20 q-14 -2 -16 -14 q-2 -16 14 -18 q6 -16 24 -16 z" fill="#7BD34A" />
        <path d="M32 78 q0 12 6 12 q6 0 6 -12 z" fill="#7BD34A" />
        <path d="M60 76 q0 14 6 14 q6 0 6 -14 z" fill="#7BD34A" />
        <path d="M42 26 q8 -6 16 0" fill="none" stroke="#4FA824" strokeWidth="5" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="48" r="10" fill="#B9F08E" opacity="0.75" />
    </svg>
  );
}

export default function GooeyOverlay({ gooey }) {
  if (!gooey) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {gooey.stage === 'launch' && (
        <div className="dd-goo-stream absolute -left-[12%] top-[38%] h-[26%] w-[124%]">
          <div className="h-full w-full rounded-full border-[5px] border-[#151515] bg-[#7BD34A] shadow-[0_0_28px_rgba(123,211,74,0.85)]" />
          <span className="dd-drip absolute -bottom-6 left-[18%] h-8 w-5 rounded-b-full border-[4px] border-[#151515] bg-[#7BD34A]" />
          <span className="dd-drip absolute -bottom-8 left-[52%] h-10 w-6 rounded-b-full border-[4px] border-[#151515] bg-[#7BD34A]" />
          <span className="dd-drip absolute -bottom-6 left-[78%] h-8 w-5 rounded-b-full border-[4px] border-[#151515] bg-[#7BD34A]" />
        </div>
      )}

      {gooey.stage === 'splatter' &&
        gooey.spots.map((spot, index) => {
          const [reel, row] = spot.split('-').map(Number);
          return (
            <span
              key={spot}
              className="dd-goo-splat absolute block h-[19%] w-[19%] -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${reel * 20 + 10}%`,
                top: `${row * 20 + 10}%`,
                animationDelay: `${index * 0.06}s`,
              }}
            >
              <Splat />
            </span>
          );
        })}
    </div>
  );
}