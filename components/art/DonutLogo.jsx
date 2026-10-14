import React from 'react';
import { cn } from '@/lib/utils';
import { Image } from '@/components/ui/image';
import { LOGO_IMAGE } from '@/config/gameAssets';

// Donut Division emblem, rendered from the supplied logo artwork (square).
const WIDTHS = {
  lg: 'w-[min(56vw,340px)]',
  md: 'w-[min(50vw,260px)]',
  sm: 'w-[min(30vw,120px)]',
};

export default function DonutLogo({ size = 'md', className = '' }) {
  return (
    <Image
      src={LOGO_IMAGE}
      alt="Donut Division"
      fittingType="fill"
      className={cn(
        'aspect-square rounded-[1.5rem] drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]',
        WIDTHS[size] || WIDTHS.md,
        className,
      )}
    />
  );
}