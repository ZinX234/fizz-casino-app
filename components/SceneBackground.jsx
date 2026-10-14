const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React from 'react';
import { Image } from '@/components/ui/image';

// Generated background art (original, AI-created for this game).
export const STREET_BG = 'https://media.db.com/images/public/6ac52dd61fb7f0e1d83cc330/b10cbfb34_generated_image.png';
export const DESK_BG = 'https://media.db.com/images/public/6ac52dd61fb7f0e1d83cc330/f736e4ed5_generated_image.png';

// City street backdrop for the main game screen.
export default function SceneBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Image src={STREET_BG} alt="" className="absolute inset-0 block h-full w-full" fittingType="fill" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,11,8,0.34)_0%,rgba(14,11,8,0.06)_34%,rgba(14,11,8,0.62)_100%)]" />
    </div>
  );
}