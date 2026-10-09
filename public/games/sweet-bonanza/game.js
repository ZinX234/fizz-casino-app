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

const game = document.getElementById('game');
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

// Export for React component to call
window.game = {
  spin: async function(outcome) {
    if (isAnimating) return;
    isAnimating = true;

    try {
      game.classList.add('preview-changing');
      await wait(180);
      
      // Render the server-generated board
      if (outcome && outcome.grid) {
        renderBoard(outcome.grid, true);
      }
      
      game.classList.remove('preview-changing');
      await wait(720);
    } finally {
      game.classList.remove('preview-changing');
      isAnimating = false;
    }
  }
};

// Initialize with empty board
renderBoard([
  ['a b c g h', 'm p s z a', 'b c g h m', 'p s z a b', 'c g h m p']
]);
