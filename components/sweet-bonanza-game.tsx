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

    // Load integration script that hooks into the game without modifying original files
    const integrationScript = document.createElement('script')
    integrationScript.textContent = `
      // Wait for original game to load, then hook into it
      window.addEventListener('load', function() {
        setTimeout(function() {
          const originalPlayOneBoard = window.playOneBoard;
          if (originalPlayOneBoard) {
            window.playOneBoard = async function() {
              const wagerInput = document.getElementById('wager');
              const wager = wagerInput ? Number(wagerInput.value) : 400;
              
              try {
                const response = await fetch('/api/games/sweet-bonanza/play', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'start',
                    requestId: crypto.randomUUID(),
                    wagerCents: wager / 4,
                    mineCount: 0,
                    expectedRtpBps: 9600,
                    profileId: 'standard',
                  }),
                });
                const data = await response.json();
                
                if (!response.ok) {
                  alert(data.error || 'Spin failed');
                  return;
                }
                
                // Update balance display
                const balanceDisplay = document.getElementById('balance-value');
                if (balanceDisplay && data.wallet.balance) {
                  balanceDisplay.textContent = data.wallet.balance;
                }
                
                // Render the server-generated grid
                const grid = data.round?.sweetBonanza?.grid;
                if (grid) {
                  const game = document.getElementById('game');
                  game.classList.add('preview-changing');
                  await new Promise(r => setTimeout(r, 180));
                  
                  const symbolFiles = {
                    a: 'img/aple.png',
                    b: 'img/banana.png',
                    c: 'img/konFIL.png',
                    g: 'img/vinog.png',
                    h: 'img/heart.png',
                    m: 'img/melon.png',
                    p: 'img/persik.png',
                    s: 'img/konSIN.png',
                    z: 'img/konZEL.png',
                  };
                  
                  const fragment = document.createDocumentFragment();
                  for (const row of grid) {
                    for (const code of row.split(' ')) {
                      const cell = document.createElement('div');
                      cell.className = 'cell';
                      const image = document.createElement('img');
                      image.src = symbolFiles[code];
                      image.alt = '';
                      image.draggable = false;
                      image.className = 'fruit-bounce-drop';
                      cell.appendChild(image);
                      fragment.appendChild(cell);
                    }
                  }
                  game.replaceChildren(fragment);
                  game.classList.remove('preview-changing');
                  await new Promise(r => setTimeout(r, 720));
                }
                
                // Show win if any
                if (data.round.payout !== '0.00') {
                  const winDisplay = document.getElementById('win-value');
                  if (winDisplay) {
                    winDisplay.textContent = data.round.payout;
                  }
                }
              } catch (error) {
                console.error('Spin failed:', error);
                alert('Spin failed. Please try again.');
              }
            };
          }
        }, 500);
      });
    `
    document.body.appendChild(integrationScript)

    return () => {
      document.head.removeChild(link)
      document.body.removeChild(script)
      document.body.removeChild(integrationScript)
    }
  }, [])

  return (
    <div className="relative w-full h-screen flex items-center justify-center" style={{ background: 'url(/games/sweet-bonanza/фон.png) no-repeat center center', backgroundSize: 'cover' }}>
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
          style={{ position: 'fixed', bottom: '140px', left: '32px', padding: '8px 28px', borderRadius: '20px', border: '3px solid #ffe066', background: 'linear-gradient(90deg, #2c2c2c 0%, #3a2d0b 50%, #2c2c2c 100%)', color: '#ffe066', fontSize: '26px', fontWeight: '900', textAlign: 'center', letterSpacing: '2px', boxShadow: '0 0 16px 2px rgba(255,179,0,0.35)', outline: 'none' }}
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
