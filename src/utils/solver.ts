import { Board, CellValue } from "../types/sudoku";
import { isValidPlacement } from "./validation";

function findEmptyCell(board: Board): { row: number; col: number } | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col].value === null) {
        return { row, col };
      }
    }
  }
  return null;
}

export function solve(board: Board): boolean {
  const empty = findEmptyCell(board);

  if (!empty) return true;

  const { row, col } = empty;

  for (let num = 1; num <= 9; num++) {
    if (isValidPlacement(board, row, col, num)) {
      board[row][col].value = num as CellValue;

      if (solve(board)) return true;

      board[row][col].value = null;
    }
  }

  return false;
}

export function countSolutions(board: Board, limit: number = 2): number {
  const empty = findEmptyCell(board);
  if (!empty) return 1;

  const { row, col } = empty;
  let count = 0;

  for (let num = 1; num <= 9; num++) {
    if (isValidPlacement(board, row, col, num)) {
      board[row][col].value = num as CellValue;
      count += countSolutions(board, limit);
      board[row][col].value = null;

      if (count >= limit) return count;
    }
  }

  return count;
}
