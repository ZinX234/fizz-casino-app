import React from 'react';

// The reel container styled as the division's mobile investigation unit.
export default function ReelFrame({ children }) {
  return (
    <div className="relative w-full rounded-[28px] border-[6px] border-[#151515] bg-[linear-gradient(180deg,#38495C_0%,#1C2833_58%,#0E161D_100%)] p-2.5 shadow-[0_22px_50px_rgba(0,0,0,0.5)] md:p-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <span className="rounded-full border-[3px] border-[#151515] bg-[#FFD44D] px-2.5 py-1 font-display text-[9px] tracking-[0.14em] text-[#151515] md:text-[10px]">
          MOBILE UNIT 12
        </span>
        <span className="flex gap-1.5">
          {['#E14B3B', '#FFD44D', '#57C4E5'].map((color, index) => (
            <span
              key={color}
              className="dd-pulse-slow h-2.5 w-2.5 rounded-full border-2 border-[#151515] md:h-3 md:w-3"
              style={{ backgroundColor: color, animationDelay: `${index * 0.35}s` }}
            />
          ))}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-[18px] border-[5px] border-[#151515] bg-[#F2EEE3] p-1.5 shadow-[inset_0_4px_14px_rgba(0,0,0,0.25)] md:p-2">
        {children}
      </div>

      <div className="mt-2 flex items-center justify-center gap-3">
        <span className="h-3.5 w-20 rounded-full border-[3px] border-[#151515] bg-[#2C3B4C] md:w-28" />
        <span className="h-3.5 w-20 rounded-full border-[3px] border-[#151515] bg-[#2C3B4C] md:w-28" />
      </div>
    </div>
  );
}