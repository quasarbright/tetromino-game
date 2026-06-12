import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { solve, checkPockets, getUniqueRotations, normalizeShape, PIECE_ROTATIONS, pieceType } from './solver.mjs';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_IDS = new Set(['I','O','T','S','Z','L','J']);

// Verify a solved grid: all cells filled with valid piece IDs, and every
// contiguous same-ID group has exactly 4 cells.
function validateSolution(grid, rows, cols) {
  assert.ok(grid !== null, 'solver returned null');
  assert.equal(grid.length, rows * cols);

  for (const cell of grid) {
    assert.ok(cell !== null, 'grid has unfilled cell');
    assert.ok(VALID_IDS.has(pieceType(cell)), `unknown piece id: ${cell}`);
  }

  // Each contiguous group of same-id cells must have size 4
  const visited = new Uint8Array(rows * cols);
  for (let start = 0; start < grid.length; start++) {
    if (visited[start]) continue;
    const id = grid[start];
    const stack = [start];
    visited[start] = 1;
    const group = [];
    while (stack.length) {
      const idx = stack.pop();
      group.push(idx);
      const r = (idx / cols) | 0, c = idx % cols;
      const neighbors = [idx-cols, idx+cols, idx-1, idx+1];
      for (const ni of neighbors) {
        if (ni < 0 || ni >= grid.length) continue;
        const nr = (ni / cols) | 0, nc = ni % cols;
        if (Math.abs(nc - c) > 1) continue; // prevent row wrap
        if (!visited[ni] && grid[ni] === id) { visited[ni]=1; stack.push(ni); }
      }
    }
    assert.equal(group.length, 4, `contiguous group of '${id}' at index ${start} has size ${group.length}, expected 4`);
  }
}

// Build a grid from a 2D array of strings (null = empty)
function makeGrid(rows) {
  return rows.flat();
}

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('normalizeShape', () => {
  test('already normalized', () => {
    const result = normalizeShape([[0,0],[0,1],[0,2],[0,3]]);
    assert.deepEqual(result, [[0,0],[0,1],[0,2],[0,3]]);
  });

  test('shifts negative coordinates to 0', () => {
    const result = normalizeShape([[-1,0],[0,0],[1,0],[2,0]]);
    assert.deepEqual(result, [[0,0],[1,0],[2,0],[3,0]]);
  });

  test('sorts by row then col', () => {
    const result = normalizeShape([[1,0],[0,1],[1,1],[0,0]]);
    assert.deepEqual(result, [[0,0],[0,1],[1,0],[1,1]]);
  });
});

describe('getUniqueRotations', () => {
  const counts = { I:2, O:1, T:4, S:2, Z:2, L:4, J:4 };
  for (const p of PIECE_ROTATIONS) {
    test(`${p.id} has ${counts[p.id]} unique rotation(s)`, () => {
      assert.equal(p.rotations.length, counts[p.id]);
    });
  }

  test('each rotation of I covers 4 cells', () => {
    const p = PIECE_ROTATIONS.find(p => p.id === 'I');
    for (const r of p.rotations) assert.equal(r.length, 4);
  });

  test('I rotations are horizontal and vertical', () => {
    const p = PIECE_ROTATIONS.find(p => p.id === 'I');
    const keys = p.rotations.map(r => JSON.stringify(r));
    assert.ok(keys.includes(JSON.stringify([[0,0],[0,1],[0,2],[0,3]])), 'missing horizontal');
    assert.ok(keys.includes(JSON.stringify([[0,0],[1,0],[2,0],[3,0]])), 'missing vertical');
  });
});

describe('checkPockets', () => {
  test('empty 4x4 grid passes', () => {
    const grid = new Array(16).fill(null);
    assert.ok(checkPockets(grid, 4, 4));
  });

  test('fully filled grid passes (no empty regions)', () => {
    const grid = new Array(16).fill('I');
    assert.ok(checkPockets(grid, 4, 4));
  });

  test('rejects 1-cell isolated pocket', () => {
    // Fill a 4x4 with one isolated empty cell surrounded by filled cells
    const grid = new Array(16).fill('I');
    grid[5] = null; // center-ish cell, fully surrounded
    assert.ok(!checkPockets(grid, 4, 4));
  });

  test('rejects 2-cell pocket', () => {
    const grid = new Array(16).fill('I');
    grid[5] = null;
    grid[6] = null;
    assert.ok(!checkPockets(grid, 4, 4));
  });

  test('accepts 4-cell pocket with balanced parity', () => {
    // Empty 1x4 row, rest filled
    const grid = new Array(16).fill('I');
    grid[0] = null; grid[1] = null; grid[2] = null; grid[3] = null;
    assert.ok(checkPockets(grid, 4, 4));
  });

  test('rejects 4-cell pocket with bad parity (all same checkerboard color)', () => {
    // A 2x2 block where all cells have the same checkerboard color is impossible
    // (r+c) parity: (0,0)=0, (0,2)=0, (2,0)=0, (2,2)=0 — all black, |4-0|*2=8 > 4
    const grid = new Array(16).fill('I');
    grid[0*4+0] = null; // (0,0) black
    grid[0*4+2] = null; // (0,2) black
    grid[2*4+0] = null; // (2,0) black
    grid[2*4+2] = null; // (2,2) black
    // These 4 cells are NOT connected (diagonal gaps), so there are 4 size-1 pockets
    assert.ok(!checkPockets(grid, 4, 4));
  });

  test('rejects two disconnected pockets of size 2', () => {
    const grid = new Array(16).fill('I');
    grid[0] = null; grid[1] = null;   // top-left 1x2
    grid[14] = null; grid[15] = null; // bottom-right 1x2
    assert.ok(!checkPockets(grid, 4, 4));
  });

  test('accepts two disconnected pockets each of size 4', () => {
    const grid = new Array(16).fill('I');
    // Top row: 4 empty cells
    grid[0]=null; grid[1]=null; grid[2]=null; grid[3]=null;
    // Bottom row: 4 empty cells
    grid[12]=null; grid[13]=null; grid[14]=null; grid[15]=null;
    assert.ok(checkPockets(grid, 4, 4));
  });
});

describe('solve — small boards', () => {
  test('solve(1, 4) — single I piece', () => {
    const grid = solve(1, 4);
    validateSolution(grid, 1, 4);
  });

  test('solve(2, 4) — two pieces', () => {
    const grid = solve(2, 4);
    validateSolution(grid, 2, 4);
  });

  test('solve(4, 4) — four pieces', () => {
    const grid = solve(4, 4);
    validateSolution(grid, 4, 4);
  });

  test('solve(2, 8) — four pieces, wide', () => {
    const grid = solve(2, 8);
    validateSolution(grid, 2, 8);
  });

  test('solve(4, 8) — eight pieces', () => {
    const grid = solve(4, 8);
    validateSolution(grid, 4, 8);
  });

  test('solve(3, 3) — returns null (9 cells, not divisible by 4)', () => {
    assert.equal(solve(3, 3), null);
  });

  test('solve(1, 3) — returns null (3 cells)', () => {
    assert.equal(solve(1, 3), null);
  });
});

describe('solve — 8x8', () => {
  test('solves 8x8 and produces a valid tiling', () => {
    const start = Date.now();
    const grid = solve(8, 8);
    const ms = Date.now() - start;
    console.log(`  8x8 solved in ${ms}ms`);
    validateSolution(grid, 8, 8);
  });
});
