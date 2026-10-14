import React, { useState } from 'react';
import SceneBackground from '@/components/SceneBackground';
import DetectiveLeft from '@/components/art/DetectiveLeft';
import DetectiveRight from '@/components/art/DetectiveRight';
import DonutLogo from '@/components/art/DonutLogo';
import ReelFrame from '@/components/game/ReelFrame';
import ReelGrid from '@/components/game/ReelGrid';
import GooeyOverlay from '@/components/game/GooeyOverlay';
import WinDisplay from '@/components/game/WinDisplay';
import WinBanner from '@/components/game/WinBanner';
import ControlBar from '@/components/game/ControlBar';
import BuyBonusButton from '@/components/game/BuyBonusButton';
import BonusChoiceModal from '@/components/game/BonusChoiceModal';
import PickBonusBoard from '@/components/game/PickBonusBoard';
import FreeSpinsHud from '@/components/game/FreeSpinsHud';
import MaxWinSequence from '@/components/game/MaxWinSequence';
import MenuPanel from '@/components/game/MenuPanel';
import SettingsPanel from '@/components/game/SettingsPanel';
import useSlotGame from '@/hooks/useSlotGame';

// Main game screen: street scene, flanking detectives, the mobile unit reel
// container and the control bar.
export default function GameScreen({ demo, onExit, initialRound, initialBalance, rtpBps, currency }) {
  const game = useSlotGame({ demo, initialRound, initialBalance, rtpBps, currency });
  const [panel, setPanel] = useState(null);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#2B2116]">
      <SceneBackground />

      <DetectiveLeft className="pointer-events-none absolute bottom-[186px] left-[-4%] hidden h-[46vh] max-h-[420px] min-h-[260px] w-auto drop-shadow-[0_14px_22px_rgba(0,0,0,0.45)] md:block lg:left-[1%]" />
      <DetectiveRight className="pointer-events-none absolute bottom-[186px] right-[-4%] hidden h-[46vh] max-h-[420px] min-h-[260px] w-auto drop-shadow-[0_14px_22px_rgba(0,0,0,0.45)] md:block lg:right-[1%]" />

      <main className="relative z-20 mx-auto flex min-h-screen w-full max-w-[620px] flex-col items-center justify-center gap-2 px-3 pb-[196px] pt-5 md:pb-[136px]">
        <DonutLogo size="sm" className="mb-1" />

        <ReelFrame>
          <div className="relative aspect-square w-full">
            <ReelGrid
              grid={game.grid}
              spinning={game.spinning}
              stoppedReels={game.stoppedReels}
              winCells={game.winCells}
              spinId={game.spinId}
            />
            <GooeyOverlay gooey={game.gooey} />
            <WinBanner banner={game.banner} />
          </div>
        </ReelFrame>

        <WinDisplay
          displayWin={game.displayWin}
          winAmount={game.winAmount}
          lines={game.winLines.length}
          demo={demo}
          rtp={game.rtp}
          className="w-full"
        />

        {game.message ? (
          <p className="rounded-full border-2 border-[#151515] bg-[#D8412F] px-3 py-1 text-center font-body text-[11px] font-extrabold uppercase tracking-wide text-white">
            {game.message}
          </p>
        ) : null}

        {!demo && !game.canAfford && !game.message ? (
          <p className="rounded-full border-2 border-[#151515] bg-[#221F1B]/90 px-3 py-1 text-center font-body text-[11px] font-extrabold uppercase tracking-wide text-[#FFD44D]">
            No Fizz Coins yet — add some to place a real bet
          </p>
        ) : null}
      </main>

      <BuyBonusButton />

      <ControlBar
        game={game}
        onMenu={() => setPanel('menu')}
        onSettings={() => setPanel('settings')}
        onExitDemo={onExit}
      />

      <FreeSpinsHud freeSpins={game.freeSpins} />
      {game.bonusChoice ? <BonusChoiceModal onSelect={game.selectBonus} /> : null}
      {game.pickBonus ? <PickBonusBoard pickBonus={game.pickBonus} onPick={game.pickCard} bet={game.bet} /> : null}
      {game.maxWin ? <MaxWinSequence maxWin={game.maxWin} /> : null}
      {panel === 'menu' ? <MenuPanel onClose={() => setPanel(null)} onExit={onExit} rtp={game.rtp} /> : null}
      {panel === 'settings' ? <SettingsPanel game={game} onClose={() => setPanel(null)} /> : null}
    </div>
  );
}