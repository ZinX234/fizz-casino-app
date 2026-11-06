import React from 'react';
import FeatureArt from '@/components/art/FeatureArt';

export default function FeatureCard({ id, title, text, index }) {
  return (
    <article
      className="dd-rise rounded-3xl border-[5px] border-[#151515] bg-[#FFF6E2] p-4 shadow-[0_8px_0_#151515]"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="mx-auto mb-3 h-24 max-w-48">
        <FeatureArt id={id} />
      </div>
      <h2 className="font-display text-center text-base tracking-[0.12em] text-[#151515]">{title}</h2>
      <p className="mt-2 text-center font-body text-xs font-bold leading-snug text-[#151515]/75">{text}</p>
    </article>
  );
}
