const PIECE_DEFS = [
  { id: 'I', cells: [[0,0],[0,1],[0,2],[0,3]] },
  { id: 'O', cells: [[0,0],[0,1],[1,0],[1,1]] },
  { id: 'T', cells: [[0,1],[1,0],[1,1],[1,2]] },
  { id: 'S', cells: [[0,1],[0,2],[1,0],[1,1]] },
  { id: 'Z', cells: [[0,0],[0,1],[1,1],[1,2]] },
  { id: 'L', cells: [[0,0],[1,0],[2,0],[2,1]] },
  { id: 'J', cells: [[0,1],[1,1],[2,0],[2,1]] },
];

export function normalizeShape(cells) {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([,c]) => c));
  const norm = cells.map(([r,c]) => [r-minR, c-minC]);
  norm.sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  return norm;
}

function rotateCW(cells) {
  return normalizeShape(cells.map(([r,c]) => [c,-r]));
}

export function getUniqueRotations(cells) {
  const rotations = [];
  const seen = new Set();
  let cur = normalizeShape(cells);
  for (let i = 0; i < 4; i++) {
    const key = JSON.stringify(cur);
    if (!seen.has(key)) {
      seen.add(key);
      rotations.push(cur);
    }
    cur = rotateCW(cur);
  }
  return rotations;
}

export const PIECE_ROTATIONS = PIECE_DEFS.map(p => ({
  id: p.id,
  rotations: getUniqueRotations(p.cells),
}));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i+1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Pruning ───────────────────────────────────────────────────────────────────

// Flood-fill empty cells into connected components.
// Each component must have size divisible by 4.
// Each component must satisfy the checkerboard parity bound:
//   |black - white| * 2 <= size
// (since each T/S/Z shifts balance by ±2, max achievable imbalance = 2*(size/4) = size/2)
export function checkPockets(grid, rows, cols) {
  const n = rows * cols;
  const visited = new Uint8Array(n);

  for (let start = 0; start < n; start++) {
    if (grid[start] !== null || visited[start]) continue;

    const stack = [start];
    visited[start] = 1;
    let size = 0, black = 0;

    while (stack.length) {
      const idx = stack.pop();
      const r = (idx / cols) | 0;
      const c = idx % cols;
      size++;
      if ((r + c) % 2 === 0) black++;

      const up = idx - cols, down = idx + cols, left = idx - 1, right = idx + 1;
      if (r > 0       && !visited[up]    && grid[up]    === null) { visited[up]=1;    stack.push(up);    }
      if (r < rows-1  && !visited[down]  && grid[down]  === null) { visited[down]=1;  stack.push(down);  }
      if (c > 0       && !visited[left]  && grid[left]  === null) { visited[left]=1;  stack.push(left);  }
      if (c < cols-1  && !visited[right] && grid[right] === null) { visited[right]=1; stack.push(right); }
    }

    if (size % 4 !== 0) return false;
    if (Math.abs(black - (size - black)) * 2 > size) return false;
  }
  return true;
}

// ── Solver ────────────────────────────────────────────────────────────────────

// solve returns a flat grid of strings like "I_3", "O_7" — unique per placement.
// Use pieceType(id) to recover the piece letter for coloring.
export function pieceType(id) { return id.split('_')[0]; }

export function solve(rows, cols) {
  if ((rows * cols) % 4 !== 0) return null;

  const grid = new Array(rows * cols).fill(null);
  let counter = 0;
  const usageCount = Object.fromEntries(PIECE_ROTATIONS.map(p => [p.id, 0]));

  // Shuffle rotations once; piece order is re-sorted dynamically by usage
  const pieces = PIECE_ROTATIONS.map(p => ({
    id: p.id,
    rotations: shuffle(p.rotations),
  }));

  function backtrack() {
    const first = grid.indexOf(null);
    if (first === -1) return true; // all cells filled

    if (!checkPockets(grid, rows, cols)) return false;

    const tr = (first / cols) | 0;
    const tc = first % cols;

    // Prefer less-used piece types; break ties randomly
    const ordered = shuffle(pieces).sort((a, b) => usageCount[a.id] - usageCount[b.id]);

    for (const { id, rotations } of ordered) {
      for (const shape of rotations) {
        // Try placing shape so each of its cells lands on (tr, tc) in turn.
        // Only valid if (tr,tc) is covered and all other cells are in-bounds and empty.
        for (const [pr, pc] of shape) {
          const dr = tr - pr, dc = tc - pc;

          let valid = true;
          const placed = [];
          for (const [r, c] of shape) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr*cols+nc] !== null) {
              valid = false; break;
            }
            placed.push(nr*cols+nc);
          }
          if (!valid) continue;

          const uid = `${id}_${counter++}`;
          for (const i of placed) grid[i] = uid;
          usageCount[id]++;
          if (backtrack()) return true;
          for (const i of placed) grid[i] = null;
          usageCount[id]--;
          counter--;
        }
      }
    }
    return false;
  }

  return backtrack() ? grid : null;
}
