"use client";

export default function ShatterpointLobbyExit() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("fizz:shatterpoint-leave"))}
      className="flex items-center gap-3 text-sm font-bold text-white"
      aria-label="Exit Shatterpoint"
    >
      <img src="/fizz-casino-logo.png" alt="" className="h-12 w-12 object-contain" />
      <span className="hidden sm:inline">Exit game</span>
    </button>
  );
}
