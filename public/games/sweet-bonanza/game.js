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

  const board = presetBoards[boardIndex];
  boardIndex += 1;
  if (boardIndex === presetBoards.length) boardIndex = 0;

  try {
    game.classList.add('preview-changing');
    await wait(180);
    renderBoard(board, true);
    game.classList.remove('preview-changing');
    await wait(720);
  } finally {
    game.classList.remove('preview-changing');
    playButton.textContent = 'Play';
    playButton.disabled = false;
    isAnimating = false;
  }
}

playButton.addEventListener('click', playOneBoard);
renderBoard(presetBoards[0]);
