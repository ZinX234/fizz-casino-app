'use client'

import { useEffect } from 'react'

export default function SweetBonanzaGame() {
  useEffect(() => {
    // Load the original game's CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/games/sweet-bonanza/style.css'
    document.head.appendChild(link)

    // Load the original game's JavaScript
    const script = document.createElement('script')
    script.src = '/games/sweet-bonanza/game.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      document.head.removeChild(link)
      document.body.removeChild(script)
    }
  }, [])

  return (
    <div className="relative w-full h-screen flex items-center justify-center" style={{ background: 'url(/games/sweet-bonanza/фон.png) no-repeat center center fixed', backgroundSize: 'cover' }}>
      <div id="site-fixed-container">
        <div id="game-wrapper">
          <div id="game"></div>
        </div>
        <div id="balance"></div>
        <div id="win-panel"></div>
        <div id="bet-panel"></div>
        <input 
          id="wager" 
          type="number" 
          defaultValue="400" 
          min="400" 
          max="40000" 
          step="4"
          className="hidden"
        />
        <button id="play">Play</button>
        <div id="fizzcoins-balance">
          <div id="fizzcoins-icon">⚡</div>
          <div id="fizzcoins-copy">
            <div id="fizzcoins-label">BALANCE</div>
            <div id="fizzcoins-value">0</div>
          </div>
        </div>
        <button id="bet-settings-btn">Bet</button>
      </div>
    </div>
  )
}
