import React from 'react';

// Original illustrations for the three feature cards on the intro screen.
export default function FeatureArt({ id }) {
  if (id === 'goo') {
    return (
      <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
        <path d="M28 96 q-18 -22 4 -34 q-6 -26 22 -26 q12 -16 32 -6 q22 -10 30 12 q24 4 16 32 q4 22 -22 24 z" fill="#7BD34A" stroke="#151515" strokeWidth="6" />
        <path d="M52 96 q0 16 7 16 q7 0 7 -16 z" fill="#7BD34A" stroke="#151515" strokeWidth="5" />
        <path d="M92 96 q0 20 8 20 q8 0 8 -20 z" fill="#7BD34A" stroke="#151515" strokeWidth="5" />
        <path d="M130 96 q0 14 7 14 q7 0 7 -14 z" fill="#7BD34A" stroke="#151515" strokeWidth="5" />
        <rect x="34" y="40" width="34" height="34" rx="7" fill="#FFF6C2" stroke="#151515" strokeWidth="5" />
        <rect x="82" y="34" width="34" height="34" rx="7" fill="#FFF6C2" stroke="#151515" strokeWidth="5" />
        <rect x="130" y="44" width="34" height="34" rx="7" fill="#FFF6C2" stroke="#151515" strokeWidth="5" />
        <path d="M51 48 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1 z" fill="#D8412F" stroke="#151515" strokeWidth="3" />
        <path d="M99 42 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1 z" fill="#D8412F" stroke="#151515" strokeWidth="3" />
        <path d="M147 52 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1 z" fill="#D8412F" stroke="#151515" strokeWidth="3" />
      </svg>
    );
  }
  if (id === 'bonus') {
    return (
      <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
        <rect x="14" y="26" width="74" height="76" rx="4" fill="#F6E4BE" stroke="#151515" strokeWidth="6" />
        <path d="M20 44 h60 M20 56 h60 M20 68 h44" stroke="#B9A38A" strokeWidth="4" strokeLinecap="round" />
        <circle cx="60" cy="88" r="9" fill="#D8412F" stroke="#151515" strokeWidth="4" />
        <rect x="112" y="20" width="74" height="82" rx="6" fill="#FFFFFF" stroke="#151515" strokeWidth="6" />
        <rect x="122" y="34" width="54" height="26" rx="4" fill="#FFD44D" stroke="#151515" strokeWidth="4" />
        <path d="M132 60 l6 -12 6 12 12 2 -9 8 3 12 -12 -6 -12 6 3 -12 -9 -8 z" fill="#7BD34A" stroke="#151515" strokeWidth="4" />
        <rect x="122" y="74" width="54" height="18" rx="4" fill="#D8412F" stroke="#151515" strokeWidth="4" />
        <path d="M96 48 h10" stroke="#151515" strokeWidth="5" strokeLinecap="round" />
        <path d="M96 86 h10" stroke="#151515" strokeWidth="5" strokeLinecap="round" />
        <rect x="34" y="66" width="18" height="26" rx="3" fill="#E8C88F" stroke="#151515" strokeWidth="4" transform="rotate(-10 43 79)" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      <rect x="18" y="16" width="164" height="88" rx="6" fill="#E2BE83" stroke="#151515" strokeWidth="6" />
      <rect x="30" y="28" width="52" height="40" rx="3" fill="#FFF6E2" stroke="#151515" strokeWidth="4" />
      <rect x="92" y="28" width="52" height="40" rx="3" fill="#FFF6E2" stroke="#151515" strokeWidth="4" />
      <rect x="30" y="76" width="114" height="16" rx="3" fill="#FFF6E2" stroke="#151515" strokeWidth="4" />
      <path d="M56 68 L108 68 M118 48 L146 84" stroke="#D8412F" strokeWidth="4" />
      <text
        x="100"
        y="62"
        textAnchor="middle"
        fontFamily="'Luckiest Guy', system-ui, sans-serif"
        fontSize="34"
        fill="#D8412F"
        stroke="#151515"
        strokeWidth="4"
        paintOrder="stroke"
      >
        12,500x
      </text>
      <circle cx="154" cy="90" r="8" fill="#7BD34A" stroke="#151515" strokeWidth="4" />
    </svg>
  );
}