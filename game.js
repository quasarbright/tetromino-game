import { solve, pieceType } from './solver.mjs';

// ── Colors ────────────────────────────────────────────────────────────────────
const PIECE_COLORS = {
  I: '#00b4d8', O: '#f4d03f', T: '#9b59b6',
  S: '#2ecc71', Z: '#e74c3c', L: '#e67e22', J: '#1a6fd4',
};

// ── Piece definitions ─────────────────────────────────────────────────────────
// anchor: piece-local [row, col] that stays under the cursor during placement/rotation
const PIECES = {
  I: { id: 'I', color: 'I', anchor: [0,1], cells: [[0,0],[0,1],[0,2],[0,3]] },
  O: { id: 'O', color: 'O', anchor: [0,0], cells: [[0,0],[0,1],[1,0],[1,1]] },
  T: { id: 'T', color: 'T', anchor: [1,1], cells: [[0,1],[1,0],[1,1],[1,2]] },
  S: { id: 'S', color: 'S', anchor: [1,1], cells: [[0,1],[0,2],[1,0],[1,1]] },
  Z: { id: 'Z', color: 'Z', anchor: [0,1], cells: [[0,0],[0,1],[1,1],[1,2]] },
  L: { id: 'L', color: 'L', anchor: [2,0], cells: [[0,0],[1,0],[2,0],[2,1]] },
  J: { id: 'J', color: 'J', anchor: [2,1], cells: [[0,1],[1,1],[2,0],[2,1]] },
};

const MODES = { easy: [4,4], medium: [6,6], hard: [8,8] };
let ROWS = 4;
let COLS = 4;

let placementCounter = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────
function clonePiece(p) {
  return { ...p, anchor: [...p.anchor], cells: p.cells.map(c => [...c]) };
}

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  grid: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
  inventory: {},
  selectedType: null,
  currentPiece: null,
  hover: null,
  solution: null,     // flat grid from solver, for the solution overlay
  showingSolution: false,
};

// ── Game init ─────────────────────────────────────────────────────────────────
function initGame() {
  state.showingSolution = false;
  document.getElementById('btn-solution').textContent = 'Show solution';
  const solution = solve(ROWS, COLS);
  state.solution = solution;
  // Count unique piece instances (each piece occupies 4 cells, deduplicate by uid)
  const counts = {};
  const seen = new Set();
  for (const id of solution) {
    if (seen.has(id)) continue;
    seen.add(id);
    const t = pieceType(id);
    counts[t] = (counts[t] || 0) + 1;
  }
  state.inventory = counts;
  state.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  state.selectedType = null;
  state.currentPiece = null;
  state.hover = null;
  placementCounter = 0;

}

function selectType(type) {
  if (!type || !state.inventory[type]) return;
  state.selectedType = type;
  // Reset rotation when switching types; preserve rotation when re-selecting same type
  if (!state.currentPiece || state.currentPiece.id !== type) {
    state.currentPiece = clonePiece(PIECES[type]);
  }
  state.hover = null;
}

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
  if (!state.currentPiece) return;
  state.currentPiece.cells = rotateCells(
    state.currentPiece.cells, state.currentPiece.anchor, dir
  );
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
  const uid = placementCounter++;
  const snapshot = { cells: piece.cells.map(c => [...c]), anchor: [...piece.anchor] };
  getPlacementCells(piece, hoverRow, hoverCol).forEach(([r, c]) => {
    state.grid[r][c] = { uid, color: piece.color, snapshot };
  });
  state.inventory[piece.id]--;
  state.selectedType = null;
  state.currentPiece = null;
  state.hover = null;
}

function pickUpPiece(uid) {
  // Find all cells belonging to this piece
  const cells = [];
  let color = null;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.grid[r][c]?.uid === uid) {
        cells.push([r, c]);
        color = state.grid[r][c].color;
      }
    }
  }
  const snapshot = state.grid[cells[0][0]][cells[0][1]].snapshot;
  for (const [r, c] of cells) state.grid[r][c] = null;
  state.inventory[color]++;
  state.selectedType = color;
  state.currentPiece = {
    id: color, color,
    anchor: [...snapshot.anchor],
    cells: snapshot.cells.map(c => [...c]),
  };
}

function checkWin() {
  return state.grid.every(row => row.every(cell => cell !== null));
}

// ── Canvas rendering ──────────────────────────────────────────────────────────
const CELL = 56;
const GRID_COLOR        = '#0f0f1a';
const EMPTY_COLOR       = '#16213e';
const OUTLINE_COLOR     = 'rgba(0,0,0,0.55)';
const GHOST_INVALID_COLOR = '#ef4444';

function drawPieceOutlines(ctx, cells, color, alpha) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2;
  ctx.lineCap = 'square';

  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));
  const inPiece = (r, c) => cellSet.has(`${r},${c}`);

  ctx.beginPath();
  for (const [r, c] of cells) {
    const x = c * CELL, y = r * CELL;
    if (!inPiece(r-1, c)) { ctx.moveTo(x,      y);      ctx.lineTo(x+CELL, y);      }
    if (!inPiece(r+1, c)) { ctx.moveTo(x,      y+CELL); ctx.lineTo(x+CELL, y+CELL); }
    if (!inPiece(r, c-1)) { ctx.moveTo(x,      y);      ctx.lineTo(x,      y+CELL); }
    if (!inPiece(r, c+1)) { ctx.moveTo(x+CELL, y);      ctx.lineTo(x+CELL, y+CELL); }
  }
  ctx.stroke();
  ctx.restore();
}

function solutionAsGrid() {
  // Convert flat solver output into a 2D grid of {uid, color} for rendering
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const uidMap = {};
  let next = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = state.solution[r * COLS + c];
      if (!(id in uidMap)) uidMap[id] = next++;
      g[r][c] = { uid: uidMap[id], color: pieceType(id) };
    }
  }
  return g;
}

function renderGrid() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = GRID_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Empty cells
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = EMPTY_COLOR;
      ctx.fillRect(c*CELL + 1, r*CELL + 1, CELL - 1, CELL - 1);
    }
  }

  const displayGrid = state.showingSolution ? solutionAsGrid() : state.grid;

  // Placed pieces — fill
  ctx.save();
  if (state.showingSolution) ctx.globalAlpha = 0.75;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = displayGrid[r][c];
      if (!cell) continue;
      ctx.fillStyle = PIECE_COLORS[cell.color];
      ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
    }
  }
  ctx.restore();

  // Placed pieces — outlines grouped by uid
  const drawn = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = displayGrid[r][c];
      if (!cell || drawn.has(cell.uid)) continue;
      drawn.add(cell.uid);
      const cells = [];
      for (let rr = 0; rr < ROWS; rr++)
        for (let cc = 0; cc < COLS; cc++)
          if (displayGrid[rr][cc]?.uid === cell.uid) cells.push([rr, cc]);
      drawPieceOutlines(ctx, cells, OUTLINE_COLOR, state.showingSolution ? 0.6 : 1);
    }
  }

  // Highlight hovered placed piece when nothing is selected (pickup mode)
  if (!state.showingSolution && state.hover !== null && !state.currentPiece) {
    const { row, col } = state.hover;
    const hovered = state.grid[row]?.[col];
    if (hovered) {
      const cells = [];
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (state.grid[r][c]?.uid === hovered.uid) cells.push([r, c]);
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      for (const [r, c] of cells) ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
      ctx.restore();
      drawPieceOutlines(ctx, cells, '#ffffff', 0.7);
    }
  }

  // Ghost
  if (!state.showingSolution && state.hover !== null && state.currentPiece) {
    const piece = state.currentPiece;
    const { row, col } = state.hover;
    const valid = isValidPlacement(piece, row, col);
    const ghostCells = getPlacementCells(piece, row, col);
    const ghostColor = valid ? PIECE_COLORS[piece.color] : GHOST_INVALID_COLOR;

    ctx.save();
    ctx.globalAlpha = 0.55;
    for (const [r, c] of ghostCells) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      ctx.fillStyle = ghostColor;
      ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
    }
    ctx.restore();

    const inBounds = ghostCells.filter(([r,c]) => r>=0&&r<ROWS&&c>=0&&c<COLS);
    drawPieceOutlines(ctx, inBounds, OUTLINE_COLOR, 0.7);
  }
}

function buildGrid() {
  const canvas = document.getElementById('game-canvas');
  canvas.width  = COLS * CELL;
  canvas.height = ROWS * CELL;

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

// ── Piece tray ────────────────────────────────────────────────────────────────
function buildPiecePreview(pieceId) {
  const piece = PIECES[pieceId];
  const minR = Math.min(...piece.cells.map(([r]) => r));
  const minC = Math.min(...piece.cells.map(([, c]) => c));
  const normCells = piece.cells.map(([r, c]) => [r - minR, c - minC]);
  const maxR = Math.max(...normCells.map(([r]) => r));
  const maxC = Math.max(...normCells.map(([, c]) => c));

  const preview = document.createElement('div');
  preview.className = 'piece-preview';
  preview.style.setProperty('--ps', '16px');
  preview.style.gridTemplateColumns = `repeat(${maxC + 1}, var(--ps))`;
  preview.style.gridTemplateRows = `repeat(${maxR + 1}, var(--ps))`;

  const cellSet = new Set(normCells.map(([r, c]) => `${r},${c}`));
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const pc = document.createElement('div');
      pc.className = 'piece-preview-cell';
      if (cellSet.has(`${r},${c}`)) pc.classList.add(`color-${piece.color}`);
      else pc.style.background = 'transparent';
      preview.appendChild(pc);
    }
  }
  return preview;
}

function renderTray() {
  const el = document.getElementById('hand');
  el.innerHTML = '';

  // Show piece types that appear in the solution, sorted by type ID
  const types = Object.keys(state.inventory).sort();
  for (const type of types) {
    const count = state.inventory[type];
    const card = document.createElement('div');
    card.className = 'piece-card';
    if (count === 0) card.classList.add('used');
    if (type === state.selectedType) card.classList.add('selected');

    card.appendChild(buildPiecePreview(type));

    const badge = document.createElement('span');
    badge.className = 'piece-count';
    badge.textContent = `×${count}`;
    card.appendChild(badge);

    card.addEventListener('click', e => {
      e.stopPropagation();
      if (count > 0) { selectType(type); render(); }
    });
    el.appendChild(card);
  }
}

function renderStatus() {
  const el = document.getElementById('status');
  const newBtn = document.getElementById('btn-new-puzzle');
  if (checkWin()) {
    el.textContent = '🎉 Puzzle solved!';
    newBtn.style.display = '';
    return;
  } else if (state.currentPiece) {
    el.textContent = 'Click the grid to place • Z / X to rotate • Esc to deselect';
  } else {
    el.textContent = 'Select a piece from the tray • Left-click a placed piece to pick it up • Right-click to remove it';
  }
  newBtn.style.display = 'none';
}

function render() {
  renderGrid();
  renderTray();
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

  if (!state.currentPiece) {
    const placed = state.grid[row]?.[col];
    if (placed) { pickUpPiece(placed.uid); render(); }
    return;
  }

  if (isValidPlacement(state.currentPiece, row, col)) {
    placePiece(state.currentPiece, row, col);
    render();
  }
});

document.getElementById('grid').addEventListener('contextmenu', e => {
  e.preventDefault();
  if (checkWin()) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const row = +cell.dataset.row;
  const col = +cell.dataset.col;
  const placed = state.grid[row]?.[col];
  if (!placed) return;

  // Remove piece and return to inventory without selecting it
  const cells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (state.grid[r][c]?.uid === placed.uid) cells.push([r, c]);
  for (const [r, c] of cells) state.grid[r][c] = null;
  state.inventory[placed.color]++;
  render();
});

document.addEventListener('keydown', e => {
  if (e.key === 'z' || e.key === 'Z') rotatePiece(-1);
  if (e.key === 'x' || e.key === 'X') rotatePiece(1);
  if (e.key === 'Escape') {
    state.selectedType = null;
    state.currentPiece = null;
    state.hover = null;
    render();
  }
});

document.addEventListener('click', e => {
  if (!state.currentPiece) return;
  if (!e.target.closest('#grid-container') && !e.target.closest('#hand')) {
    state.selectedType = null;
    state.currentPiece = null;
    state.hover = null;
    render();
  }
});

document.getElementById('btn-rotate-ccw').addEventListener('click', e => { e.stopPropagation(); rotatePiece(-1); });
document.getElementById('btn-rotate-cw').addEventListener('click', e => { e.stopPropagation(); rotatePiece(1); });
document.getElementById('btn-solution').addEventListener('click', e => {
  e.stopPropagation();
  state.showingSolution = !state.showingSolution;
  e.target.textContent = state.showingSolution ? 'Hide solution' : 'Show solution';
  render();
});

document.getElementById('btn-new-puzzle').addEventListener('click', e => {
  e.stopPropagation();
  buildGrid();
  initGame();
  render();
});

// ── Mode picker ───────────────────────────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    [ROWS, COLS] = MODES[btn.dataset.mode];
    buildGrid();
    initGame();
    render();
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
buildGrid();
initGame();
render();
