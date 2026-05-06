import { Server, Socket } from "socket.io";
import { getRoomBySocketId, getRoom, resetTimer } from "../../rooms/roomManager";
import { isValidPlacement } from "../../utils/validation";
import { generatePuzzle } from "../../utils/generator";
import { generateSeed } from "../../utils/random";
import {
  serializeBoard,
  getPlayerStats,
} from "../../utils/serialize";
import { ClientEvents, CellValue } from "../../types/sudoku";

export function registerGameHandlers(io: Server, socket: Socket): void {
  // ---- PLACE_NUMBER ----
  socket.on("PLACE_NUMBER", (data: ClientEvents["PLACE_NUMBER"]) => {
    const ctx = getRoomBySocketId(socket.id);
    if (!ctx) return;

    const { room, player } = ctx;
    const { row, col, value } = data;

    // Validate input
    if (row < 0 || row > 8 || col < 0 || col > 8) return;
    if (value !== null && (value < 1 || value > 9)) return;

    // Can't place on fixed cells
    if (room.board[row][col].isFixed) return;

    // Determine if placement is an error
    let isError = false;

    if (value !== null) {
      if (room.validationMode === "strict") {
        isError = value !== room.solution[row][col];
      } else {
        // Conflict mode — check against current board state
        isError = !isValidPlacement(room.board, row, col, value);
      }
    }

    // Update server board
    room.board[row][col].value = value;
    room.board[row][col].isError = isError;
    room.lastActivity = Date.now();

    // Track cell ownership
    const cellKey = `${row},${col}`;
    if (value !== null) {
      room.cellOwners.set(cellKey, player.id);
      player.cellsPlaced++;
    } else {
      room.cellOwners.delete(cellKey);
    }

    // Broadcast to all players in room
    io.to(room.code).emit("BOARD_UPDATED", {
      row,
      col,
      value,
      playerId: player.id,
      isError,
    });

    // Check for game completion
    checkCompletion(io, room);
  });

  // ---- CLEAR_CELL ----
  socket.on("CLEAR_CELL", (data: ClientEvents["CLEAR_CELL"]) => {
    const ctx = getRoomBySocketId(socket.id);
    if (!ctx) return;

    const { room, player } = ctx;
    const { row, col } = data;

    if (row < 0 || row > 8 || col < 0 || col > 8) return;
    if (room.board[row][col].isFixed) return;

    // Clear the cell
    room.board[row][col].value = null;
    room.board[row][col].isError = false;
    room.lastActivity = Date.now();

    // Remove ownership
    const cellKey = `${row},${col}`;
    room.cellOwners.delete(cellKey);

    // Broadcast
    io.to(room.code).emit("CELL_CLEARED", {
      row,
      col,
      playerId: player.id,
    });
  });

  // ---- SELECT_CELL ----
  socket.on("SELECT_CELL", (data: ClientEvents["SELECT_CELL"]) => {
    const ctx = getRoomBySocketId(socket.id);
    if (!ctx) return;

    const { room, player } = ctx;
    const { row, col } = data;

    if (row < 0 || row > 8 || col < 0 || col > 8) return;

    player.selectedCell = { row, col };

    // Broadcast to other players (not back to sender)
    socket.to(room.code).emit("CELL_SELECTED", {
      row,
      col,
      playerId: player.id,
    });
  });

  // ---- NEW_GAME ---- (creator only)
  socket.on("NEW_GAME", (data: ClientEvents["NEW_GAME"]) => {
    const ctx = getRoomBySocketId(socket.id);
    if (!ctx) return;

    const { room, player } = ctx;

    // Only creator can start a new game
    if (room.creatorId !== player.id) {
      socket.emit("ERROR", { message: "Only the room creator can start a new game" });
      return;
    }

    const { difficulty, seed: customSeed, validationMode } = data;

    if (!["easy", "medium", "hard"].includes(difficulty)) {
      socket.emit("ERROR", { message: "Invalid difficulty" });
      return;
    }

    const seed = customSeed ?? generateSeed();
    const isCustomSeed = customSeed !== undefined;
    const { board, solution } = generatePuzzle(difficulty, seed);

    // Update room state
    room.board = board;
    room.solution = solution;
    room.difficulty = difficulty;
    room.seed = seed;
    room.isCustomSeed = isCustomSeed;
    room.cellOwners = new Map();
    room.lastActivity = Date.now();

    if (validationMode && ["conflict", "strict"].includes(validationMode)) {
      room.validationMode = validationMode;
    }

    // Reset player stats
    for (const [, p] of room.players) {
      p.cellsPlaced = 0;
      p.selectedCell = null;
    }

    // Reset timer
    resetTimer(room);

    // Broadcast to all
    io.to(room.code).emit("NEW_GAME_STARTED", {
      board: serializeBoard(board),
      seed,
      difficulty,
      isCustomSeed,
      validationMode: room.validationMode,
    });

    console.log(
      `[Room ${room.code}] New game | ${difficulty} | ${room.validationMode} | seed: ${seed}`
    );
  });
}

// ============================================
// Completion check
// ============================================

function checkCompletion(io: Server, room: any): void {
  // All cells must be filled
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (room.board[r][c].value === null) return;
    }
  }

  // No errors allowed
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (room.board[r][c].isError) return;
    }
  }

  // In conflict mode, also verify against solution
  if (room.validationMode === "conflict") {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (room.board[r][c].value !== room.solution[r][c]) return;
      }
    }
  }

  // Game complete!
  io.to(room.code).emit("GAME_COMPLETE", {
    stats: getPlayerStats(room),
    time: room.timer,
  });

  console.log(
    `[Room ${room.code}] Game complete! Time: ${room.timer}s`
  );
}
