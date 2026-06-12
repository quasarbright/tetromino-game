// ── Piece definitions (cells as [row, col] offsets from origin) ──────────────
// anchor: the piece-local [row, col] that stays under the cursor during placement/rotation
const PIECES = [
  { id: 'I', color: 'I', anchor: [0,1], cells: [[0,0],[0,1],[0,2],[0,3]] },
  { id: 'O', color: 'O', anchor: [0,0], cells: [[0,0],[0,1],[1,0],[1,1]] },
  { id: 'T', color: 'T', anchor: [1,1], cells: [[0,1],[1,0],[1,1],[1,2]] },
  { id: 'S', color: 'S', anchor: [1,1], cells: [[0,1],[0,2],[1,0],[1,1]] },
  { id: 'Z', color: 'Z', anchor: [0,1], cells: [[0,0],[0,1],[1,1],[1,2]] },
  { id: 'L', color: 'L', anchor: [2,0], cells: [[0,0],[1,0],[2,0],[2,1]] },
  { id: 'J', color: 'J', anchor: [2,1], cells: [[0,1],[1,1],[2,0],[2,1]] },
];

const ROWS = 4;
const COLS = 4;

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
  pieces: PIECES.map(p => ({ ...p, anchor: [...p.anchor], cells: p.cells.map(c => [...c]), rotation: 0, used: false })),
  selected: null,
  hover: null,
};

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
  if (state.selected === null) return;
  const piece = state.pieces[state.selected];
  piece.cells = rotateCells(piece.cells, piece.anchor, dir);
  render();
}

// ── Grid helpers ──────────────────────────────────────────────────────────────
function getPlacementCells(piece, hoverRow, hoverCol) {
  const [ar, ac] = piece.anchor;
  return piece.cells.map(([r, c]) => [r - ar + hoverRow, c - ac + hoverCol]);
}

function isValidPlacement(piece, anchorRow, anchorCol) {
  const cells = getPlacementCells(piece, anchorRow, anchorCol);
  return cells.every(([r, c]) =>
    r >= 0 && r < ROWS && c >= 0 && c < COLS && state.grid[r][c] === null
  );
}

function placePiece(piece, anchorRow, anchorCol) {
  getPlacementCells(piece, anchorRow, anchorCol).forEach(([r, c]) => {
    state.grid[r][c] = { pieceId: piece.id, color: piece.color };
  });
  piece.used = true;
  state.selected = null;
  state.hover = null;
}

function checkWin() {
  return state.grid.every(row => row.every(cell => cell !== null));
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderGrid() {
  const gridEl = document.getElementById('grid');
  gridEl.style.setProperty('--rows', ROWS);
  gridEl.style.setProperty('--cols', COLS);

  const ghostCells = new Map();
  if (state.selected !== null && state.hover !== null) {
    const piece = state.pieces[state.selected];
    const { row, col } = state.hover;
    const valid = isValidPlacement(piece, row, col);
    getPlacementCells(piece, row, col).forEach(([r, c]) => {
      ghostCells.set(`${r},${c}`, { valid, color: piece.color });
    });
  }

  // Update classes in-place instead of recreating DOM — avoids breaking click events
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = gridEl.children[r * COLS + c];
      const occupied = state.grid[r][c];
      const ghost = ghostCells.get(`${r},${c}`);

      cell.className = 'cell';
      if (occupied) {
        cell.classList.add('occupied', `color-${occupied.color}`);
      } else if (ghost) {
        if (ghost.valid) {
          cell.classList.add('occupied', 'ghost-valid', `color-${ghost.color}`);
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

function renderPieces() {
  const piecesEl = document.getElementById('pieces');
  piecesEl.innerHTML = '';

  state.pieces.forEach((piece, idx) => {
    const card = document.createElement('div');
    card.className = 'piece-card';
    if (piece.used) card.classList.add('used');
    if (idx === state.selected) card.classList.add('selected');

    const minR = Math.min(...piece.cells.map(([r]) => r));
    const minC = Math.min(...piece.cells.map(([, c]) => c));
    const normCells = piece.cells.map(([r, c]) => [r - minR, c - minC]);
    const maxR = Math.max(...normCells.map(([r]) => r));
    const maxC = Math.max(...normCells.map(([, c]) => c));
    const preview = document.createElement('div');
    preview.className = 'piece-preview';
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

    const label = document.createElement('span');
    label.className = 'piece-label';
    label.textContent = piece.id;

    card.appendChild(preview);
    card.appendChild(label);
    card.addEventListener('click', () => onPieceClick(idx));
    piecesEl.appendChild(card);
  });
}

function renderControls() {
  const hasSelected = state.selected !== null;
  document.getElementById('btn-rotate-ccw').disabled = !hasSelected;
  document.getElementById('btn-rotate-cw').disabled = !hasSelected;
  document.getElementById('btn-deselect').disabled = !hasSelected;
}

function renderStatus() {
  const el = document.getElementById('status');
  if (checkWin()) {
    el.textContent = '🎉 Puzzle solved!';
  } else if (state.selected !== null) {
    el.textContent = `Placing ${state.pieces[state.selected].id} — Z/X to rotate, Esc to deselect`;
  } else {
    el.textContent = '';
  }
}

function render() {
  renderGrid();
  renderPieces();
  renderControls();
  renderStatus();
}

// ── Event handlers ────────────────────────────────────────────────────────────
function onPieceClick(idx) {
  if (state.pieces[idx].used) return;
  state.selected = state.selected === idx ? null : idx;
  render();
}

function deselect() {
  state.selected = null;
  state.hover = null;
  render();
}

// Single delegated listener on the grid — survives renderGrid() calls
document.getElementById('grid').addEventListener('mouseover', e => {
  if (state.selected === null) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const row = +cell.dataset.row;
  const col = +cell.dataset.col;
  if (state.hover?.row === row && state.hover?.col === col) return;
  state.hover = { row, col };
  render();
});

document.getElementById('grid').addEventListener('mouseleave', () => {
  if (state.selected === null || state.hover === null) return;
  state.hover = null;
  render();
});

document.getElementById('grid').addEventListener('click', e => {
  if (state.selected === null) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const row = +cell.dataset.row;
  const col = +cell.dataset.col;
  const piece = state.pieces[state.selected];
  if (isValidPlacement(piece, row, col)) {
    placePiece(piece, row, col);
    render();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'z' || e.key === 'Z') rotatePiece(-1);
  if (e.key === 'x' || e.key === 'X') rotatePiece(1);
  if (e.key === 'Escape') deselect();
});

document.getElementById('btn-rotate-ccw').addEventListener('click', () => rotatePiece(-1));
document.getElementById('btn-rotate-cw').addEventListener('click', () => rotatePiece(1));
document.getElementById('btn-deselect').addEventListener('click', deselect);

// ── Init ──────────────────────────────────────────────────────────────────────
buildGrid();
render();
