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
    <div className="relative w-full h-full flex items-center justify-center bg-[#0f0f13]">
      <div id="site-fixed-container">
        <div id="game-wrapper">
          <div id="game"></div>
        </div>
      </div>
    </div>
  )
}
