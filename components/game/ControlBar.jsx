import React from 'react';
import { FastForward, Menu, Settings, Volume2, VolumeX, Zap } from 'lucide-react';
import IconButton from '@/components/game/IconButton';
import BetControl from '@/components/game/BetControl';
import SpinButton from '@/components/game/SpinButton';
import WalletPanel from '@/components/game/WalletPanel';

// Bottom control panel: wallet on the left, bet controls in the middle,
// spin and toggles on the right.
export default function ControlBar({ game, onMenu, onSettings, onExitDemo }) {
  const toggles = (
    <>
      <IconButton
        label="Autoplay"
        active={game.autoplayLeft > 0}
        onClick={game.toggleAutoplay}
        badge={game.autoplayLeft > 0 ? game.autoplayLeft : undefined}
      >
        <FastForward className="h-5 w-5" />
      </IconButton>
      <IconButton label="Quick spin" active={game.quickSpin} onClick={game.toggleQuickSpin}>
        <Zap className="h-5 w-5" />
      </IconButton>
      <IconButton label={game.soundOn ? 'Sound on' : 'Sound off'} active={game.soundOn} onClick={game.toggleSound}>
        {game.soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </IconButton>
    </>
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-[5px] border-[#151515] bg-[#161616]/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-2 px-2 py-2 md:flex-row md:items-center md:justify-between md:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 md:gap-2">
            <IconButton label="Menu" onClick={onMenu}>
              <Menu className="h-5 w-5" />
            </IconButton>
            <IconButton label="Settings" onClick={onSettings}>
              <Settings className="h-5 w-5" />
            </IconButton>
            <WalletPanel demo={game.demo} balance={game.balance} onExitDemo={onExitDemo} />
          </div>
          <div className="flex items-center gap-1.5 md:hidden">{toggles}</div>
        </div>

        <div className="flex items-center justify-center gap-3 md:justify-end md:gap-4">
          <BetControl bet={game.bet} onChange={game.changeBet} label={game.demo ? 'DEMO BET' : 'FIZZ BET'} />
          <div className="hidden items-center gap-2 md:flex">{toggles}</div>
          <SpinButton
            onSpin={game.spin}
            disabled={!game.canSpin}
            spinning={game.spinning}
            dimmed={!game.canAfford}
          />
        </div>
      </div>
    </div>
  );
}