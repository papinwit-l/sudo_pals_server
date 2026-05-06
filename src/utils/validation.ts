import { Board } from "../types/sudoku";

export function isValidPlacement(
  board: Board,
  row: number,
  col: number,
  value: number
): boolean {
  // Check row
  for (let c = 0; c < 9; c++) {
    if (c !== col && board[row][c].value === value) return false;
  }

  // Check column
  for (let r = 0; r < 9; r++) {
    if (r !== row && board[r][col].value === value) return false;
  }

  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if ((r !== row || c !== col) && board[r][c].value === value) return false;
    }
  }

  return true;
}

export function validateBoard(board: Board): Board {
  return board.map((row, r) =>
    row.map((cell, c) => ({
      ...cell,
      notes: new Set(cell.notes),
      isError:
        cell.value !== null
          ? !isValidPlacement(board, r, c, cell.value)
          : false,
    }))
  );
}
