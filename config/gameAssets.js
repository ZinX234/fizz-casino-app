const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

// Uploaded artwork for Donut Division. Symbols listed here are drawn from the
// supplied image files; any symbol without an entry falls back to the built-in
// vector artwork in components/art/SymbolArt.

const UPLOADS = 'https://media.db.com/images/public/6ac52dd61fb7f0e1d83cc330';

export const SYMBOL_IMAGES = {
  DET_A: `${UPLOADS}/fbac9360f_image.png`, // Officer
  PINK: `${UPLOADS}/a45aff26d_image.png`, // Frosted donut
  CHOC: `${UPLOADS}/a45aff26d_image.png`, // Frosted donut (replaces the brown donut)
  REDLIGHT: `${UPLOADS}/86da79f0e_image.png`, // Emergency light
  CONE: `${UPLOADS}/020b9f64f_image.png`, // Traffic cone
  WILD: `${UPLOADS}/dadabbe1b_image.png`, // Gooey W wild
};

export const LOGO_IMAGE = `${UPLOADS}/8a064b404_image-Photoroom5.png`;

export const getSymbolImage = (id) => SYMBOL_IMAGES[id] || null;