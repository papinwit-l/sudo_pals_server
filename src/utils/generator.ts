import { Board, CellValue, Difficulty } from "../types/sudoku";
import { createEmptyBoard } from "./board";
import { isValidPlacement } from "./validation";
import { countSolutions } from "./solver";
import { createRng, seededShuffle } from "./random";

function findEmptyCell(board: Board): { row: number; col: number } | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col].value === null) return { row, col };
    }
  }
  return null;
}

function generateSolvedBoard(random: () => number): Board {
  const board = createEmptyBoard();

  function fillBoard(board: Board): boolean {
    const empty = findEmptyCell(board);
    if (!empty) return true;

    const { row, col } = empty;
    const numbers = seededShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random);

    for (const num of numbers) {
      if (isValidPlacement(board, row, col, num)) {
        board[row][col].value = num as CellValue;
        if (fillBoard(board)) return true;
        board[row][col].value = null;
      }
    }

    return false;
  }

  fillBoard(board);
  return board;
}

function getClueCount(difficulty: Difficulty): number {
  switch (difficulty) {
    case "easy":
      return 38;
    case "medium":
      return 30;
    case "hard":
      return 25;
  }
}

function removeCells(
  board: Board,
  difficulty: Difficulty,
  random: () => number
): Board {
  const totalCells = 81;
  const cluesToKeep = getClueCount(difficulty);
  let cellsToRemove = totalCells - cluesToKeep;

  const positions: { row: number; col: number }[] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      positions.push({ row, col });
    }
  }
  const shuffled = seededShuffle(positions, random);

  for (const { row, col } of shuffled) {
    if (cellsToRemove <= 0) break;

    const backup = board[row][col].value;
    board[row][col].value = null;

    const clone = board.map((r) =>
      r.map((cell) => ({ ...cell, notes: new Set(cell.notes) }))
    );

    if (countSolutions(clone, 2) !== 1) {
      board[row][col].value = backup;
    } else {
      cellsToRemove--;
    }
  }

  return board;
}

/**
 * Generate a puzzle and its solution.
 * Returns { board, solution } where solution is the 2D array of correct values.
 */
export function generatePuzzle(
  difficulty: Difficulty,
  seed: number
): { board: Board; solution: CellValue[][] } {
  const random = createRng(seed);
  const solvedBoard = generateSolvedBoard(random);

  // Extract solution values before removing cells
  const solution: CellValue[][] = solvedBoard.map((row) =>
    row.map((cell) => cell.value)
  );

  // Remove cells to create the puzzle
  removeCells(solvedBoard, difficulty, random);

  // Mark remaining cells as fixed
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (solvedBoard[row][col].value !== null) {
        solvedBoard[row][col].isFixed = true;
      }
    }
  }

  return { board: solvedBoard, solution };
}
