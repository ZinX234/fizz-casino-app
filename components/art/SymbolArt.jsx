import React, { useId } from 'react';
import { Image } from '@/components/ui/image';
import { getSymbolImage } from '@/config/gameAssets';

// Original Donut Division symbol art. Every icon is drawn from scratch as
// flat vector shapes with heavy black outlines to match the game's look.

const OUTLINE = '#151515';

function Tile({ bg, children }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="16" fill={bg} stroke={OUTLINE} strokeWidth="7" />
      {children}
    </svg>
  );
}

function Donut({ uid, dough = '#F0B26B', icing, sprinkles = [], chips = false }) {
  const clip = `${uid}-clip`;
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <circle cx="50" cy="55" r="29" />
        </clipPath>
      </defs>
      <circle cx="50" cy="55" r="29" fill={dough} stroke={OUTLINE} strokeWidth="6" />
      <g clipPath={`url(#${clip})`}>
        <rect x="16" y="22" width="68" height="26" fill={icing} />
        <path d="M16 46 q8 8 16 1 t16 1 t16 -1 t16 1 v16 H16 Z" fill={icing} />
        {sprinkles.map((sprinkle, index) => (
          <rect
            key={index}
            x={sprinkle.x}
            y={sprinkle.y}
            width="9"
            height="3.6"
            rx="1.8"
            fill={sprinkle.color}
            stroke={OUTLINE}
            strokeWidth="1.4"
            transform={`rotate(${sprinkle.r} ${sprinkle.x + 4.5} ${sprinkle.y + 1.8})`}
          />
        ))}
        {chips && [[-14, 34], [12, 30], [-2, 44], [20, 42]].map(([dx, y], index) => (
          <ellipse key={index} cx={50 + dx} cy={y} rx="4.5" ry="3.6" fill="#3A2416" stroke={OUTLINE} strokeWidth="1.6" />
        ))}
      </g>
      <circle cx="50" cy="55" r="10.5" fill="#FFFFFF" stroke={OUTLINE} strokeWidth="5" />
    </>
  );
}

function Portrait({ bg, skin, shirt, hat, hatType, glasses, hair, beard, badge }) {
  return (
    <Tile bg={bg}>
      <path d="M16 96 q4 -28 34 -28 q30 0 34 28 z" fill={shirt} stroke={OUTLINE} strokeWidth="6" />
      <rect x="43" y="58" width="14" height="14" rx="4" fill={skin} stroke={OUTLINE} strokeWidth="5" />
      <circle cx="29" cy="51" r="5" fill={skin} stroke={OUTLINE} strokeWidth="4" />
      <circle cx="71" cy="51" r="5" fill={skin} stroke={OUTLINE} strokeWidth="4" />
      <circle cx="50" cy="48" r="21" fill={skin} stroke={OUTLINE} strokeWidth="6" />
      <path d="M30 42 q2 -19 20 -19 q18 0 20 19 q-7 -9 -20 -9 q-13 0 -20 9 z" fill={hair} stroke={OUTLINE} strokeWidth="4" />
      {hatType === 'fedora' && (
        <>
          <ellipse cx="50" cy="31" rx="31" ry="7" fill={hat} stroke={OUTLINE} strokeWidth="5" />
          <path d="M33 30 q2 -19 17 -19 q15 0 17 19 z" fill={hat} stroke={OUTLINE} strokeWidth="5" />
          <rect x="33" y="24" width="34" height="5" rx="2.5" fill={OUTLINE} opacity="0.75" />
        </>
      )}
      {hatType === 'cap' && (
        <>
          <path d="M29 32 q3 -21 21 -21 q18 0 21 21 z" fill={hat} stroke={OUTLINE} strokeWidth="5" />
          <path d="M47 31 q20 -1 24 7 q-10 4 -24 1 z" fill={hat} stroke={OUTLINE} strokeWidth="5" />
        </>
      )}
      {hatType === 'bowler' && (
        <>
          <ellipse cx="50" cy="33" rx="28" ry="5.5" fill={hat} stroke={OUTLINE} strokeWidth="5" />
          <path d="M34 33 q0 -20 16 -20 q16 0 16 20 z" fill={hat} stroke={OUTLINE} strokeWidth="5" />
        </>
      )}
      {glasses ? (
        <>
          <rect x="29" y="43" width="18" height="12" rx="5" fill="#1C1C1C" stroke={OUTLINE} strokeWidth="4" />
          <rect x="53" y="43" width="18" height="12" rx="5" fill="#1C1C1C" stroke={OUTLINE} strokeWidth="4" />
          <rect x="46" y="46" width="8" height="4" fill="#1C1C1C" />
          <path d="M34 46 l6 0" stroke="#6C6C6C" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="42" cy="47" r="3.4" fill={OUTLINE} />
          <circle cx="58" cy="47" r="3.4" fill={OUTLINE} />
          <path d="M36 40 q6 -4 12 -1" stroke={OUTLINE} strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M52 39 q6 -3 12 1" stroke={OUTLINE} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </>
      )}
      <path d="M50 50 q4 5 -1 7" fill="none" stroke={OUTLINE} strokeWidth="3.2" strokeLinecap="round" />
      {beard === 'mustache' && (
        <path d="M36 62 q14 -9 28 0 q-14 10 -28 0 z" fill={hair} stroke={OUTLINE} strokeWidth="4" />
      )}
      {beard === 'full' && (
        <path d="M32 54 q4 24 18 24 q14 0 18 -24 q-8 12 -18 12 q-10 0 -18 -12 z" fill={hair} stroke={OUTLINE} strokeWidth="4.5" />
      )}
      {beard === 'stubble' && (
        <path d="M33 56 q6 20 17 20 q11 0 17 -20 q-8 9 -17 9 q-9 0 -17 -9 z" fill={hair} opacity="0.55" />
      )}
      {badge && (
        <path d="M72 76 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 z" fill="#FFD44D" stroke={OUTLINE} strokeWidth="3.5" />
      )}
    </Tile>
  );
}

const SPRINKLES_PALE = [
  { x: 30, y: 32, r: 25, color: '#FF6FA5' },
  { x: 52, y: 30, r: -18, color: '#57C4E5' },
  { x: 40, y: 40, r: 12, color: '#FFD44D' },
  { x: 58, y: 41, r: -32, color: '#8ED96B' },
];
const SPRINKLES_PINK = [
  { x: 32, y: 33, r: -20, color: '#FFFFFF' },
  { x: 50, y: 31, r: 30, color: '#FFE066' },
  { x: 42, y: 41, r: 8, color: '#7FD1F0' },
  { x: 60, y: 40, r: -12, color: '#FFFFFF' },
];

function symbolArt(id, uid) {
  switch (id) {
    case 'SPRINKLE':
      return (
        <Tile bg="#A9DDF0">
          <Donut uid={uid} icing="#FFF6E2" sprinkles={SPRINKLES_PALE} />
        </Tile>
      );
    case 'PINK':
      return (
        <Tile bg="#F7C6DE">
          <Donut uid={uid} icing="#FF7FBE" sprinkles={SPRINKLES_PINK} />
        </Tile>
      );
    case 'CHOC':
      return (
        <Tile bg="#E6C69B">
          <Donut uid={uid} icing="#6B4324" chips />
        </Tile>
      );
    case 'CONE':
      return (
        <Tile bg="#FFD9A6">
          <path d="M20 84 h60 l-8 8 h-44 z" fill="#E97B2A" stroke={OUTLINE} strokeWidth="6" />
          <path d="M50 16 L70 82 H30 Z" fill="#F58C33" stroke={OUTLINE} strokeWidth="6" />
          <path d="M41 42 h18 l3 12 h-24 z" fill="#FFF6E2" stroke={OUTLINE} strokeWidth="5" />
          <path d="M35 66 h30 l2 9 h-34 z" fill="#FFF6E2" stroke={OUTLINE} strokeWidth="5" />
        </Tile>
      );
    case 'COFFEE':
      return (
        <Tile bg="#FFE2C6">
          <path d="M30 22 q6 -10 12 0" fill="none" stroke="#B9AFA4" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M58 22 q6 -10 12 0" fill="none" stroke="#B9AFA4" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M28 30 h44 l-6 56 H34 z" fill="#FFF8EF" stroke={OUTLINE} strokeWidth="6" />
          <rect x="24" y="22" width="52" height="12" rx="4" fill="#E5D8C8" stroke={OUTLINE} strokeWidth="5" />
          <path d="M33 52 h34 l-3 26 H36 z" fill="#C97A3C" stroke={OUTLINE} strokeWidth="5" />
          <path d="M40 60 h20" stroke="#FFF1DE" strokeWidth="4" strokeLinecap="round" />
        </Tile>
      );
    case 'DET_D':
      return <Portrait bg="#CBEBDA" skin="#F3C79E" shirt="#8FD0E8" hair="#3B2A1E" hat="#5FA84A" hatType="cap" beard="stubble" />;
    case 'DET_C':
      return <Portrait bg="#FADFC2" skin="#E8B183" shirt="#E7B84B" hair="#8C4A24" hat="#6E7378" hatType="bowler" beard="full" />;
    case 'DET_B':
      return <Portrait bg="#D8E4F7" skin="#D99C6C" shirt="#C7D9F2" hair="#221A14" hat="#2E4A7D" hatType="cap" glasses badge />;
    case 'DET_A':
      return <Portrait bg="#F2D7A8" skin="#EFC197" shirt="#C9A46B" hair="#4A3423" hat="#B98E52" hatType="fedora" glasses beard="mustache" />;
    case 'WILD':
      return (
        <Tile bg="#9FE07A">
          <path d="M50 20 l8 16 18 3 -13 12 3 18 -16 -8 -16 8 3 -18 -13 -12 18 -3 z" fill="#FFF6C2" stroke={OUTLINE} strokeWidth="5" />
          <path d="M22 52 q10 -10 22 -4 q10 5 18 -2 q12 -10 20 4 q4 12 -6 18 h-48 q-10 -6 -6 -16 z" fill="#7BD34A" stroke={OUTLINE} strokeWidth="5" />
          <path d="M30 70 q0 12 6 12 q6 0 6 -12 z" fill="#7BD34A" stroke={OUTLINE} strokeWidth="4.5" />
          <path d="M58 70 q0 14 6 14 q6 0 6 -14 z" fill="#7BD34A" stroke={OUTLINE} strokeWidth="4.5" />
          <text
            x="50"
            y="92"
            textAnchor="middle"
            fontFamily="'Luckiest Guy', system-ui, sans-serif"
            fontSize="18"
            fill="#0E3D12"
            stroke={OUTLINE}
            strokeWidth="3.5"
            paintOrder="stroke"
          >
            WILD
          </text>
        </Tile>
      );
    case 'SCATTER':
      return (
        <Tile bg="#FFEEB0">
          <path d="M18 36 h26 l6 8 h32 v48 H18 z" fill="#E2BE83" stroke={OUTLINE} strokeWidth="6" />
          <rect x="28" y="24" width="26" height="22" rx="2" fill="#FFFFFF" stroke={OUTLINE} strokeWidth="4" transform="rotate(-8 41 35)" />
          <path d="M26 44 h48 v40 H26 z" fill="#F6E4BE" stroke={OUTLINE} strokeWidth="5" />
          <text
            x="50"
            y="82"
            textAnchor="middle"
            fontFamily="'Luckiest Guy', system-ui, sans-serif"
            fontSize="42"
            fill="#D8412F"
            stroke={OUTLINE}
            strokeWidth="5"
            paintOrder="stroke"
          >
            F
          </text>
          <text x="50" y="57" textAnchor="middle" fontFamily="'Luckiest Guy', system-ui, sans-serif" fontSize="10" fill="#151515">
            CASE FILE
          </text>
        </Tile>
      );
    default:
      return <Tile bg="#EDEDED" />;
  }
}

export default function SymbolArt({ id, className = '' }) {
  const uid = useId().replace(/[:]/g, '');
  const image = getSymbolImage(id);

  // Supplied artwork wins; the vector library covers every other symbol.
  if (image) {
    return <Image src={image} alt="" fittingType="fill" className={className} />;
  }
  return <div className={className}>{symbolArt(id, uid)}</div>;
}