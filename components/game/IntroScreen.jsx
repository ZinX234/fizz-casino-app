import React from 'react';
import { Image } from '@/components/ui/image';
import DonutLogo from '@/components/art/DonutLogo';
import ProvablyFairBadge from '@/components/game/ProvablyFairBadge';
import FeatureCard from '@/components/game/FeatureCard';
import { DESK_BG } from '@/components/SceneBackground';

const CARDS = [
  {
    id: 'goo',
    title: 'GOOEY IS GOOD',
    text: 'A goo-launching feature spreads wild symbols across all positions to the left!',
  },
  {
    id: 'bonus',
    title: 'BONUS CHOICE',
    text: 'Choose between 3 bonus options when you land 3 or more case file scatters!',
  },
  {
    id: 'maxwin',
    title: 'MAX WIN',
    text: 'Crack the case and sleuth your way to a delicious donut-y max win!',
  },
];

// Title screen: detective desk, trust badge and the three feature cards.
export default function IntroScreen({ onContinue }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onContinue}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onContinue();
      }}
      className="relative min-h-screen w-full cursor-pointer overflow-hidden bg-[#F5F2E6] outline-none"
    >
      <Image src={DESK_BG} alt="" className="absolute inset-0 block h-full w-full" fittingType="fill" />
      <div className="absolute inset-0 bg-[#F5F2E6]/30" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-between gap-6 px-4 py-8">
        <header className="flex flex-col items-center gap-4">
          <DonutLogo size="lg" />
          <ProvablyFairBadge />
        </header>

        <section className="grid w-full gap-5 md:grid-cols-3">
          {CARDS.map((card, index) => (
            <FeatureCard key={card.id} id={card.id} title={card.title} text={card.text} index={index} />
          ))}
        </section>

        <p className="dd-pulse-slow font-display text-lg tracking-[0.22em] text-[#151515] md:text-2xl">
          CLICK TO CONTINUE
        </p>
      </div>
    </div>
  );
}