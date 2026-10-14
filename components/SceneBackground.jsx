const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React from 'react';

export const STREET_BG = '/games/donut-division-background.png';
export const DESK_BG = 'https://media.db.com/images/public/6ac52dd61fb7f0e1d83cc330/f736e4ed5_generated_image.png';

// City street backdrop for the main game screen.
export default function SceneBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#160b2b]">
      <img
        src={STREET_BG}
        alt=""
        className="absolute inset-0 block h-full w-full object-contain object-center"
      />
    </div>
  );
}