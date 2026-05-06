import { Board } from "../types/sudoku";

export function createEmptyBoard(): Board {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => ({
      value: null,
      isFixed: false,
      notes: new Set<number>(),
      isError: false,
    }))
  );
}
