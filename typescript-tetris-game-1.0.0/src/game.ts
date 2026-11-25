// Pure game rules for Vector Blocks.
// Everything in here is free of DOM/canvas access so it can be unit-tested.

export const COLUMNS = 10;
export const ROWS = 20;

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Matrix = number[][];
export type Piece = { type: PieceType; matrix: Matrix; x: number; y: number };
export type Cell = PieceType | null;
export type Board = Cell[][];

export const SHAPES: Record<PieceType, Matrix> = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
};

export const PIECE_TYPES = Object.keys(SHAPES) as PieceType[];

/** Points per number of lines cleared at once (before the level multiplier). */
export const LINE_REWARDS = [0, 100, 300, 500, 800];

/** Horizontal offsets tried, in order, when a rotation collides ("wall kicks"). */
export const KICK_OFFSETS = [0, -1, 1, -2, 2];

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLUMNS).fill(null));
}

/** Returns all seven piece types in random order (Fisher-Yates shuffle). */
export function shuffledBag(random: () => number = Math.random): PieceType[] {
  const types = [...PIECE_TYPES];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

/** Creates a new piece, horizontally centred at the top of the board. */
export function createPiece(type: PieceType): Piece {
  const matrix = SHAPES[type].map((row) => [...row]);
  return { type, matrix, x: Math.floor((COLUMNS - matrix[0].length) / 2), y: 0 };
}

/** True if the piece, shifted by (dx, dy), would leave the board or overlap a filled cell. */
export function collision(board: Board, piece: Piece, dx = 0, dy = 0, matrix: Matrix = piece.matrix): boolean {
  return matrix.some((row, rowIndex) => row.some((value, columnIndex) => {
    if (!value) return false;
    const x = piece.x + columnIndex + dx;
    const y = piece.y + rowIndex + dy;
    return x < 0 || x >= COLUMNS || y >= ROWS || (y >= 0 && board[y][x] !== null);
  }));
}

/** Rotates a matrix 90 degrees clockwise. */
export function rotate(matrix: Matrix): Matrix {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]).reverse());
}

/** Rotates the piece clockwise, trying wall kicks. Returns null if no position fits. */
export function rotateWithKicks(board: Board, piece: Piece): Piece | null {
  const rotated = rotate(piece.matrix);
  for (const offset of KICK_OFFSETS) {
    if (!collision(board, piece, offset, 0, rotated)) {
      return { ...piece, matrix: rotated, x: piece.x + offset };
    }
  }
  return null;
}

/** How many rows the piece can fall before it lands. */
export function dropDistance(board: Board, piece: Piece): number {
  let distance = 0;
  while (!collision(board, piece, 0, distance + 1)) distance += 1;
  return distance;
}

/** Returns a new board with the piece written into it. Cells above the board are ignored. */
export function mergePiece(board: Board, piece: Piece): Board {
  const next = board.map((row) => [...row]);
  piece.matrix.forEach((row, y) => row.forEach((value, x) => {
    const boardY = piece.y + y;
    if (value && boardY >= 0) next[boardY][piece.x + x] = piece.type;
  }));
  return next;
}

/** Removes full rows, adds empty rows on top and reports how many were cleared. */
export function clearLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter((row) => !row.every((cell) => cell !== null));
  const cleared = board.length - remaining.length;
  while (remaining.length < ROWS) remaining.unshift(Array<Cell>(COLUMNS).fill(null));
  return { board: remaining, cleared };
}

/** Score for clearing `cleared` lines at once on the given level. */
export function lineClearScore(cleared: number, level: number): number {
  if (cleared <= 0) return 0;
  return (LINE_REWARDS[cleared] ?? 800) * level;
}

/** Level for a total number of cleared lines (a new level every 10 lines, starting at 1). */
export function levelForLines(lines: number): number {
  return Math.floor(lines / 10) + 1;
}

/** Milliseconds between automatic drops; gets faster per level, never below 90 ms. */
export function dropInterval(level: number): number {
  return Math.max(90, 800 - (level - 1) * 65);
}
