const symbolFiles = {
  a: '/games/sweet-bonanza/img/aple.png',
  b: '/games/sweet-bonanza/img/banana.png',
  c: '/games/sweet-bonanza/img/konFIL.png',
  g: '/games/sweet-bonanza/img/vinog.png',
  h: '/games/sweet-bonanza/img/heart.png',
  m: '/games/sweet-bonanza/img/melon.png',
  p: '/games/sweet-bonanza/img/persik.png',
  s: '/games/sweet-bonanza/img/konSIN.png',
  z: '/games/sweet-bonanza/img/konZEL.png',
};

// These fixed boards are animation samples, not generated game outcomes.
const sequences = [
  [
    ['g b h p s c', 'm a c b z p', 'p h g m a b', 'c z b g h m', 'b p s a g c'],
    ['g b h p s c', 'm a c b z p', 'p h a m a b', 'c z b g h m', 'b p s a g c'],
    ['g b h p s c', 'm a c b z p', 'p h z m g b', 'c z b g h m', 'b p s a g c'],
  ],
  [
    ['a h s b p z', 'g m a c h b', 'p z g h s m', 'b c p a g z', 'h s m b c p'],
    ['a h s b p z', 'g m a c h b', 'p z g h a m', 'b c p a g z', 'h s m b c p'],
    ['a h s b p z', 'g m a c h b', 'p z g c a m', 'b c p a g z', 'h s m b c p'],
  ],
  [
    ['z p g h a c', 'b s m p z g', 'h a c b p s', 'm g z h c a', 'p b h s m g'],
    ['z p g h a c', 'b s m p z g', 'h a c b p s', 'm g z h a a', 'p b h s m g'],
    ['z p g h a c', 'b s m p z g', 'h a c b p s', 'm g z c z a', 'p b h s m g'],
  ],
];
const presetBoards = sequences.flat();

const game = document.getElementById('game');
const playButton = document.getElementById('play');
let boardIndex = 0;
let isAnimating = false;

function renderBoard(rows, animate = false) {
  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    for (const code of row.split(' ')) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      const image = document.createElement('img');
      image.src = symbolFiles[code];
      image.alt = '';
      image.draggable = false;
      if (animate) image.className = 'fruit-bounce-drop';

      cell.appendChild(image);
      fragment.appendChild(cell);
    }
  }

  game.replaceChildren(fragment);
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function playOneBoard() {
  if (isAnimating) return;
  isAnimating = true;
  playButton.disabled = true;
  playButton.textContent = 'Playing…';

  const wagerInput = document.getElementById('wager');
  const wager = wagerInput ? Number(wagerInput.value) : 400;

  try {
    // Fetch current Sweet Bonanza configuration to get RTP
    const configResponse = await fetch('/api/admin/sweet-bonanza-settings');
    const configData = await configResponse.json();
    
    // Get the active profile's RTP
    const activeProfile = configData.configuration?.profiles?.find(p => p.id === configData.configuration.activeProfileId);
    const rtpBps = activeProfile?.rtpBps || 9600; // Default to 96% if not found
    const profileId = activeProfile?.id || 'standard';

    // Call FizzCoins backend API with the current RTP
    const response = await fetch('/api/games/sweet-bonanza/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        requestId: crypto.randomUUID(),
        wagerCents: wager / 4,
        mineCount: 0,
        expectedRtpBps: rtpBps,
        profileId: profileId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || 'Spin failed');
      playButton.textContent = 'Play';
      playButton.disabled = false;
      isAnimating = false;
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
      game.classList.add('preview-changing');
      await wait(180);
      renderBoard(grid, true);
      game.classList.remove('preview-changing');
      await wait(720);
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
  } finally {
    game.classList.remove('preview-changing');
    playButton.textContent = 'Play';
    playButton.disabled = false;
    isAnimating = false;
  }
}

playButton.addEventListener('click', playOneBoard);
renderBoard(presetBoards[0]);
