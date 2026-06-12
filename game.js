// ── Colors ────────────────────────────────────────────────────────────────────
const PIECE_COLORS = {
  I: '#00b4d8', O: '#f4d03f', T: '#9b59b6',
  S: '#2ecc71', Z: '#e74c3c', L: '#e67e22', J: '#3498db',
};

// ── Piece definitions ─────────────────────────────────────────────────────────
// anchor: piece-local [row, col] that stays under the cursor during placement/rotation
const PIECES = [
  { id: 'I', color: 'I', anchor: [0,1], cells: [[0,0],[0,1],[0,2],[0,3]] },
  { id: 'O', color: 'O', anchor: [0,0], cells: [[0,0],[0,1],[1,0],[1,1]] },
  { id: 'T', color: 'T', anchor: [1,1], cells: [[0,1],[1,0],[1,1],[1,2]] },
  { id: 'S', color: 'S', anchor: [1,1], cells: [[0,1],[0,2],[1,0],[1,1]] },
  { id: 'Z', color: 'Z', anchor: [0,1], cells: [[0,0],[0,1],[1,1],[1,2]] },
  { id: 'L', color: 'L', anchor: [2,0], cells: [[0,0],[1,0],[2,0],[2,1]] },
  { id: 'J', color: 'J', anchor: [2,1], cells: [[0,1],[1,1],[2,0],[2,1]] },
];

const ROWS = 8;
const COLS = 8;
const HAND_SIZE = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────
function clonePiece(p) {
  return { ...p, anchor: [...p.anchor], cells: p.cells.map(c => [...c]) };
}

function randomPiece() {
  return clonePiece(PIECES[Math.floor(Math.random() * PIECES.length)]);
}

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
  hand: Array.from({ length: HAND_SIZE }, randomPiece),
  selectedIndex: 0,
  hover: null,
};

function selected() { return state.hand[state.selectedIndex]; }

// ── Rotation ──────────────────────────────────────────────────────────────────
function rotateCells(cells, anchor, dir) {
  // Rotate around the anchor cell; CW: [dr,dc]→[dc,-dr], CCW: [dr,dc]→[-dc,dr]
  const [ar, ac] = anchor;
  return cells.map(([r, c]) => {
    const dr = r - ar, dc = c - ac;
    const [nr, nc] = dir === 1 ? [dc, -dr] : [-dc, dr];
    return [ar + nr, ac + nc];
  });
}

function rotatePiece(dir) {
  const piece = selected();
  piece.cells = rotateCells(piece.cells, piece.anchor, dir);
  render();
}

// ── Grid helpers ──────────────────────────────────────────────────────────────
function getPlacementCells(piece, hoverRow, hoverCol) {
  const [ar, ac] = piece.anchor;
  return piece.cells.map(([r, c]) => [r - ar + hoverRow, c - ac + hoverCol]);
}

function isValidPlacement(piece, hoverRow, hoverCol) {
  return getPlacementCells(piece, hoverRow, hoverCol).every(([r, c]) =>
    r >= 0 && r < ROWS && c >= 0 && c < COLS && state.grid[r][c] === null
  );
}

function placePiece(piece, hoverRow, hoverCol) {
  getPlacementCells(piece, hoverRow, hoverCol).forEach(([r, c]) => {
    state.grid[r][c] = { pieceId: piece.id, color: piece.color };
  });
  state.hand[state.selectedIndex] = randomPiece();
  state.hover = null;
}

function checkWin() {
  return state.grid.every(row => row.every(cell => cell !== null));
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderGrid() {
  const gridEl = document.getElementById('grid');
  const piece = selected();

  const ghostCells = new Map();
  if (state.hover !== null) {
    const { row, col } = state.hover;
    const valid = isValidPlacement(piece, row, col);
    getPlacementCells(piece, row, col).forEach(([r, c]) => {
      ghostCells.set(`${r},${c}`, { valid, color: piece.color });
    });
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = gridEl.children[r * COLS + c];
      const occupied = state.grid[r][c];
      const ghost = ghostCells.get(`${r},${c}`);

      cell.className = 'cell';
      cell.style.removeProperty('--ghost-color');
      if (occupied) {
        cell.classList.add('occupied', `color-${occupied.color}`);
      }
      if (ghost) {
        if (ghost.valid) {
          cell.classList.add('ghost-valid');
          cell.style.setProperty('--ghost-color', PIECE_COLORS[ghost.color]);
        } else {
          cell.classList.add('ghost-invalid');
        }
      }
    }
  }
}

function buildGrid() {
  const gridEl = document.getElementById('grid');
  gridEl.innerHTML = '';
  gridEl.style.setProperty('--rows', ROWS);
  gridEl.style.setProperty('--cols', COLS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      gridEl.appendChild(cell);
    }
  }
}

function buildPiecePreview(piece) {
  const minR = Math.min(...piece.cells.map(([r]) => r));
  const minC = Math.min(...piece.cells.map(([, c]) => c));
  const normCells = piece.cells.map(([r, c]) => [r - minR, c - minC]);
  const maxR = Math.max(...normCells.map(([r]) => r));
  const maxC = Math.max(...normCells.map(([, c]) => c));

  const preview = document.createElement('div');
  preview.className = 'piece-preview';
  preview.style.setProperty('--ps', '20px');
  preview.style.gridTemplateColumns = `repeat(${maxC + 1}, var(--ps))`;
  preview.style.gridTemplateRows = `repeat(${maxR + 1}, var(--ps))`;

  const cellSet = new Set(normCells.map(([r, c]) => `${r},${c}`));
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const pc = document.createElement('div');
      pc.className = 'piece-preview-cell';
      if (cellSet.has(`${r},${c}`)) {
        pc.classList.add(`color-${piece.color}`);
      } else {
        pc.style.background = 'transparent';
      }
      preview.appendChild(pc);
    }
  }
  return preview;
}

function renderHand() {
  const el = document.getElementById('hand');
  el.innerHTML = '';
  state.hand.forEach((piece, idx) => {
    const card = document.createElement('div');
    card.className = 'piece-card';
    if (idx === state.selectedIndex) card.classList.add('selected');
    card.appendChild(buildPiecePreview(piece));
    card.addEventListener('click', () => {
      state.selectedIndex = idx;
      state.hover = null;
      render();
    });
    el.appendChild(card);
  });
}

function renderStatus() {
  const el = document.getElementById('status');
  el.textContent = checkWin() ? '🎉 Puzzle solved!' : '';
}

function render() {
  renderGrid();
  renderHand();
  renderStatus();
}

// ── Events ────────────────────────────────────────────────────────────────────
document.getElementById('grid').addEventListener('mouseover', e => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const row = +cell.dataset.row;
  const col = +cell.dataset.col;
  if (state.hover?.row === row && state.hover?.col === col) return;
  state.hover = { row, col };
  render();
});

document.getElementById('grid').addEventListener('mouseleave', () => {
  if (state.hover === null) return;
  state.hover = null;
  render();
});

document.getElementById('grid').addEventListener('click', e => {
  if (checkWin()) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const row = +cell.dataset.row;
  const col = +cell.dataset.col;
  if (isValidPlacement(selected(), row, col)) {
    placePiece(selected(), row, col);
    render();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'z' || e.key === 'Z') rotatePiece(-1);
  if (e.key === 'x' || e.key === 'X') rotatePiece(1);
  if (e.key === '1') { state.selectedIndex = 0; state.hover = null; render(); }
  if (e.key === '2') { state.selectedIndex = 1; state.hover = null; render(); }
  if (e.key === '3') { state.selectedIndex = 2; state.hover = null; render(); }
});

document.getElementById('btn-rotate-ccw').addEventListener('click', () => rotatePiece(-1));
document.getElementById('btn-rotate-cw').addEventListener('click', () => rotatePiece(1));

// ── Init ──────────────────────────────────────────────────────────────────────
buildGrid();
render();
