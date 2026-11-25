import { describe, expect, it } from 'vitest';
import {
  COLUMNS, ROWS, PIECE_TYPES, SHAPES,
  clearLines, collision, createBoard, createPiece, dropDistance, dropInterval,
  levelForLines, lineClearScore, mergePiece, rotate, rotateWithKicks, shuffledBag,
  type Board, type Piece, type PieceType,
} from './game';

/** Board with the given rows (counted from the bottom) completely filled. */
function boardWithFullRows(...rowsFromBottom: number[]): Board {
  const board = createBoard();
  for (const r of rowsFromBottom) board[ROWS - 1 - r] = Array<PieceType>(COLUMNS).fill('I');
  return board;
}

function filledCells(board: Board): number {
  return board.flat().filter((cell) => cell !== null).length;
}

describe('createBoard', () => {
  it('creates an empty 10x20 board', () => {
    const board = createBoard();
    expect(board).toHaveLength(ROWS);
    board.forEach((row) => expect(row).toHaveLength(COLUMNS));
    expect(filledCells(board)).toBe(0);
  });

  it('creates independent rows', () => {
    const board = createBoard();
    board[0][0] = 'T';
    expect(board[1][0]).toBeNull();
  });
});

describe('SHAPES', () => {
  it.each(PIECE_TYPES)('piece %s consists of exactly four blocks', (type) => {
    expect(SHAPES[type].flat().filter(Boolean)).toHaveLength(4);
  });
});

describe('shuffledBag', () => {
  it('contains each of the seven pieces exactly once', () => {
    const bag = shuffledBag();
    expect(bag).toHaveLength(7);
    expect([...bag].sort()).toEqual([...PIECE_TYPES].sort());
  });

  it('is deterministic for a given random source', () => {
    const fixed = () => 0;
    expect(shuffledBag(fixed)).toEqual(shuffledBag(fixed));
  });

  it('does not modify the shared piece list', () => {
    const before = [...PIECE_TYPES];
    shuffledBag(() => 0.5);
    expect(PIECE_TYPES).toEqual(before);
  });
});

describe('createPiece', () => {
  it('spawns pieces centred at the top', () => {
    expect(createPiece('I')).toMatchObject({ type: 'I', x: 3, y: 0 });
    expect(createPiece('O')).toMatchObject({ type: 'O', x: 4, y: 0 });
    expect(createPiece('T')).toMatchObject({ type: 'T', x: 3, y: 0 });
  });

  it('copies the shape so the template cannot be mutated', () => {
    const piece = createPiece('T');
    piece.matrix[0][0] = 9;
    expect(SHAPES.T[0][0]).toBe(0);
  });
});

describe('collision', () => {
  const board = createBoard();

  it('allows a freshly spawned piece on an empty board', () => {
    expect(collision(board, createPiece('T'))).toBe(false);
  });

  it('detects the left and right walls', () => {
    const left: Piece = { ...createPiece('O'), x: 0 };
    const right: Piece = { ...createPiece('O'), x: COLUMNS - 2 };
    expect(collision(board, left, -1, 0)).toBe(true);
    expect(collision(board, right, 1, 0)).toBe(true);
    expect(collision(board, left, 1, 0)).toBe(false);
  });

  it('detects the floor', () => {
    const piece: Piece = { ...createPiece('O'), y: ROWS - 2 };
    expect(collision(board, piece)).toBe(false);
    expect(collision(board, piece, 0, 1)).toBe(true);
  });

  it('detects filled cells', () => {
    const blocked = createBoard();
    blocked[5][4] = 'Z';
    const piece: Piece = { ...createPiece('O'), x: 4, y: 3 };
    expect(collision(blocked, piece)).toBe(false);
    expect(collision(blocked, piece, 0, 1)).toBe(true);
  });

  it('ignores empty cells of the piece matrix', () => {
    const blocked = createBoard();
    blocked[0][3] = 'Z'; // top-left of the T is an empty cell
    expect(collision(blocked, createPiece('T'))).toBe(false);
  });

  it('allows cells above the top of the board', () => {
    const piece: Piece = { ...createPiece('I'), y: -1 };
    expect(collision(board, piece)).toBe(false);
  });
});

describe('rotate', () => {
  it('rotates a matrix clockwise', () => {
    expect(rotate([[0, 1, 0], [1, 1, 1]])).toEqual([[1, 0], [1, 1], [1, 0]]);
  });

  it('turns the horizontal I into a vertical I', () => {
    expect(rotate(SHAPES.I)).toEqual([[1], [1], [1], [1]]);
  });

  it('returns to the original shape after four rotations', () => {
    for (const type of PIECE_TYPES) {
      const shape = SHAPES[type];
      expect(rotate(rotate(rotate(rotate(shape))))).toEqual(shape);
    }
  });

  it('does not mutate its input', () => {
    const shape = [[1, 0], [1, 1]];
    rotate(shape);
    expect(shape).toEqual([[1, 0], [1, 1]]);
  });
});

describe('rotateWithKicks', () => {
  it('rotates in place when there is room', () => {
    const piece: Piece = { ...createPiece('T'), y: 5 };
    const rotated = rotateWithKicks(createBoard(), piece);
    expect(rotated).not.toBeNull();
    expect(rotated!.x).toBe(piece.x);
    expect(rotated!.matrix).toEqual(rotate(piece.matrix));
  });

  it('kicks a vertical I away from the right wall', () => {
    const vertical: Piece = { type: 'I', matrix: rotate(SHAPES.I), x: COLUMNS - 2, y: 5 };
    const rotated = rotateWithKicks(createBoard(), vertical);
    expect(rotated).not.toBeNull();
    expect(rotated!.matrix).toEqual(SHAPES.I);
    expect(rotated!.x).toBe(COLUMNS - 4);
  });

  it('cannot rotate a vertical I flush against the right wall (kicks reach only 2 columns)', () => {
    const vertical: Piece = { type: 'I', matrix: rotate(SHAPES.I), x: COLUMNS - 1, y: 5 };
    expect(rotateWithKicks(createBoard(), vertical)).toBeNull();
  });

  it('returns null when no kick position fits', () => {
    const board = createBoard();
    for (let x = 0; x < COLUMNS; x++) if (x !== 4) board[3][x] = 'J';
    const vertical: Piece = { type: 'I', matrix: rotate(SHAPES.I), x: 4, y: 3 };
    expect(rotateWithKicks(board, vertical)).toBeNull();
  });

  it('does not modify the original piece', () => {
    const piece: Piece = { ...createPiece('L'), y: 5 };
    const matrixBefore = piece.matrix;
    rotateWithKicks(createBoard(), piece);
    expect(piece.matrix).toBe(matrixBefore);
  });
});

describe('dropDistance', () => {
  it('drops to the floor on an empty board', () => {
    expect(dropDistance(createBoard(), createPiece('O'))).toBe(ROWS - 2);
  });

  it('stops on top of existing blocks', () => {
    const board = boardWithFullRows(0, 1, 2);
    expect(dropDistance(board, createPiece('O'))).toBe(ROWS - 2 - 3);
  });

  it('is zero when the piece already rests on something', () => {
    const piece: Piece = { ...createPiece('O'), y: ROWS - 2 };
    expect(dropDistance(createBoard(), piece)).toBe(0);
  });
});

describe('mergePiece', () => {
  it('writes the piece type into the board', () => {
    const piece: Piece = { ...createPiece('O'), x: 0, y: ROWS - 2 };
    const merged = mergePiece(createBoard(), piece);
    expect(merged[ROWS - 2].slice(0, 2)).toEqual(['O', 'O']);
    expect(merged[ROWS - 1].slice(0, 2)).toEqual(['O', 'O']);
    expect(filledCells(merged)).toBe(4);
  });

  it('only writes the filled cells of the matrix', () => {
    const piece: Piece = { ...createPiece('T'), x: 0, y: 0 };
    const merged = mergePiece(createBoard(), piece);
    expect(merged[0].slice(0, 3)).toEqual([null, 'T', null]);
    expect(merged[1].slice(0, 3)).toEqual(['T', 'T', 'T']);
  });

  it('skips cells above the board', () => {
    const piece: Piece = { ...createPiece('O'), y: -1 };
    expect(filledCells(mergePiece(createBoard(), piece))).toBe(2);
  });

  it('returns a new board and leaves the original untouched', () => {
    const board = createBoard();
    const merged = mergePiece(board, createPiece('S'));
    expect(merged).not.toBe(board);
    expect(filledCells(board)).toBe(0);
  });
});

describe('clearLines', () => {
  it('does nothing when no row is full', () => {
    const board = createBoard();
    board[ROWS - 1][0] = 'L';
    const result = clearLines(board);
    expect(result.cleared).toBe(0);
    expect(result.board).toEqual(board);
  });

  it.each([1, 2, 3, 4])('clears %i full row(s) and keeps the board height', (count) => {
    const rows = Array.from({ length: count }, (_, i) => i);
    const result = clearLines(boardWithFullRows(...rows));
    expect(result.cleared).toBe(count);
    expect(result.board).toHaveLength(ROWS);
    expect(filledCells(result.board)).toBe(0);
  });

  it('moves the rows above a cleared line down', () => {
    const board = boardWithFullRows(0);
    board[ROWS - 2][3] = 'Z';
    const result = clearLines(board);
    expect(result.cleared).toBe(1);
    expect(result.board[ROWS - 1][3]).toBe('Z');
    expect(result.board[ROWS - 2][3]).toBeNull();
  });

  it('clears non-adjacent full rows', () => {
    const board = boardWithFullRows(0, 2);
    board[ROWS - 2][0] = 'S';
    const result = clearLines(board);
    expect(result.cleared).toBe(2);
    expect(result.board[ROWS - 1][0]).toBe('S');
    expect(filledCells(result.board)).toBe(1);
  });
});

describe('lineClearScore', () => {
  it('awards the classic points on level 1', () => {
    expect(lineClearScore(0, 1)).toBe(0);
    expect(lineClearScore(1, 1)).toBe(100);
    expect(lineClearScore(2, 1)).toBe(300);
    expect(lineClearScore(3, 1)).toBe(500);
    expect(lineClearScore(4, 1)).toBe(800);
  });

  it('multiplies by the level', () => {
    expect(lineClearScore(1, 3)).toBe(300);
    expect(lineClearScore(4, 5)).toBe(4000);
  });

  it('caps unknown line counts at the tetris reward', () => {
    expect(lineClearScore(5, 1)).toBe(800);
  });
});

describe('levelForLines', () => {
  it('starts at level 1 and goes up every 10 lines', () => {
    expect(levelForLines(0)).toBe(1);
    expect(levelForLines(9)).toBe(1);
    expect(levelForLines(10)).toBe(2);
    expect(levelForLines(25)).toBe(3);
  });
});

describe('dropInterval', () => {
  it('starts at 800 ms and speeds up by 65 ms per level', () => {
    expect(dropInterval(1)).toBe(800);
    expect(dropInterval(2)).toBe(735);
    expect(dropInterval(5)).toBe(540);
  });

  it('never goes below 90 ms', () => {
    expect(dropInterval(12)).toBe(90);
    expect(dropInterval(50)).toBe(90);
  });
});
