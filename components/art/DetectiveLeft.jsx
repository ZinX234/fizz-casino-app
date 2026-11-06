import React from 'react';

// Decorative left character: the plain-clothes detective watching the reels.
export default function DetectiveLeft({ className = '' }) {
  return (
    <svg viewBox="0 0 180 360" className={className} aria-hidden="true">
      <g stroke="#151515" strokeWidth="6" strokeLinejoin="round">
        <path d="M58 352 l2 -84 h22 l4 84 z" fill="#3B4756" />
        <path d="M96 352 l4 -84 h22 l2 84 z" fill="#33404D" />
        <path d="M54 344 q6 -10 26 -6 l1 16 h-30 z" fill="#1F262E" />
        <path d="M96 354 h30 l-1 -16 q-20 -4 -26 6 z" fill="#1F262E" />
        <path d="M44 168 q0 -14 46 -14 q46 0 46 14 l-4 100 h-84 z" fill="#C9A46B" />
        <path d="M44 268 h88 v18 h-88 z" fill="#2F3946" />
        <rect x="82" y="268" width="14" height="18" rx="3" fill="#E0B84B" />
        <path d="M86 176 q8 26 8 60 h-16 q0 -34 8 -60 z" fill="#E6D5B4" opacity="0.9" />
        <path d="M52 178 q-16 6 -20 30 q-4 24 2 46 q4 8 12 4 q10 -6 8 -22 q-2 -20 2 -46 z" fill="#B9945F" />
        <path d="M124 178 q16 6 20 30 q4 24 -2 46 q-4 8 -12 4 q-10 -6 -8 -22 q2 -20 -2 -46 z" fill="#B9945F" />
        <rect x="76" y="140" width="28" height="22" rx="6" fill="#E8B78E" />
        <circle cx="58" cy="120" r="7" fill="#E8B78E" />
        <circle cx="122" cy="120" r="7" fill="#E8B78E" />
        <circle cx="90" cy="112" r="40" fill="#F0C39A" />
        <path d="M54 104 q2 -38 36 -38 q34 0 36 38 q-12 -20 -36 -20 q-24 0 -36 20 z" fill="#3A2A1C" />
        <rect x="58" y="100" width="28" height="22" rx="9" fill="#1B1B1B" />
        <rect x="94" y="100" width="28" height="22" rx="9" fill="#1B1B1B" />
        <rect x="86" y="106" width="10" height="6" fill="#1B1B1B" />
        <path d="M64 106 l10 0" stroke="#5F5F5F" strokeWidth="4" strokeLinecap="round" />
        <path d="M90 132 q6 8 -2 12" fill="none" stroke="#151515" strokeWidth="5" strokeLinecap="round" />
        <path d="M70 146 q20 -12 40 0 q-20 12 -40 0 z" fill="#3A2A1C" />
        <path d="M76 156 q14 8 28 0" fill="none" stroke="#151515" strokeWidth="4" strokeLinecap="round" />
        <path d="M126 190 l5 10 11 2 -8 8 2 11 -10 -5 -10 5 2 -11 -8 -8 11 -2 z" fill="#E0B84B" />
      </g>
    </svg>
  );
}