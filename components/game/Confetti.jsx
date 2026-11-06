import React, { useMemo } from 'react';

// Donut confetti for big celebrations.
const ICINGS = ['#FF7FBE', '#6B4324', '#FFF6E2', '#FFD44D'];

function MiniDonut({ icing }) {
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
      <circle cx="20" cy="21" r="15" fill="#F0B26B" stroke="#151515" strokeWidth="3" />
      <path d="M7 21 a13 13 0 0 1 26 0 q-6 5 -13 2 q-7 -3 -13 -2 z" fill={icing} stroke="#151515" strokeWidth="2.5" />
      <circle cx="20" cy="21" r="5" fill="#FFFFFF" stroke="#151515" strokeWidth="2.5" />
    </svg>
  );
}

export default function Confetti({ count = 34 }) {
  const pieces = useMemo(
    () => Array.from({ length: count }, (_, index) => ({
      left: Math.random() * 100,
      delay: Math.random() * 2.6,
      duration: 3.4 + Math.random() * 2.8,
      size: 16 + Math.random() * 20,
      icing: ICINGS[index % ICINGS.length],
    })),
    [count],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="dd-confetti-piece block"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        >
          <MiniDonut icing={piece.icing} />
        </span>
      ))}
    </div>
  );
}