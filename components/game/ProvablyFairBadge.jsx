import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Trust badge shown under the logo on the intro screen.
export default function ProvablyFairBadge({ className = '' }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border-[3px] border-[#151515] bg-white/85 px-3 py-1.5',
        className,
      )}
    >
      <ShieldCheck className="h-4 w-4 text-[#151515]" strokeWidth={2.6} />
      <span className="font-display text-xs leading-none tracking-[0.18em] text-[#151515]">PROVABLY FAIR</span>
    </div>
  );
}