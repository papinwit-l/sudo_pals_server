import crypto from "crypto";
import { config } from "../config";
import {
  Room,
  Player,
  Difficulty,
  ValidationMode,
  PLAYER_COLORS,
  CellValue,
} from "../types/sudoku";
import { generatePuzzle } from "../utils/generator";
import { generateSeed } from "../utils/random";

// ============================================
// Room storage
// ============================================

const rooms = new Map<string, Room>();

// ============================================
// Room code generation
// ============================================

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let code: string;
  do {
    code = Array.from({ length: 4 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  } while (rooms.has(code));
  return code;
}

// ============================================
// Session token generation
// ============================================

function generateSessionToken(): string {
  return crypto.randomUUID();
}

function generatePlayerId(): string {
  return crypto.randomUUID();
}

// ============================================
// Room CRUD
// ============================================

export function createRoom(
  socketId: string,
  nickname: string,
  difficulty: Difficulty,
  validationMode: ValidationMode,
  customSeed?: number
): { room: Room; player: Player } | { error: string } {
  // Check room limit
  if (rooms.size >= config.maxRooms) {
    return { error: "Server is full, try again later" };
  }

  const seed = customSeed ?? generateSeed();
  const isCustomSeed = customSeed !== undefined;
  const { board, solution } = generatePuzzle(difficulty, seed);

  const code = generateRoomCode();
  const playerId = generatePlayerId();
  const sessionToken = generateSessionToken();

  const player: Player = {
    id: playerId,
    socketId,
    nickname,
    color: PLAYER_COLORS[0],
    status: "connected",
    disconnectedAt: null,
    sessionToken,
    selectedCell: null,
    notes: new Map(),
    cellsPlaced: 0,
  };

  const room: Room = {
    code,
    board,
    solution,
    difficulty,
    seed,
    isCustomSeed,
    validationMode,
    players: new Map([[playerId, player]]),
    creatorId: playerId,
    timer: 0,
    timerInterval: null,
    lastActivity: Date.now(),
    cellOwners: new Map(),
  };

  rooms.set(code, room);
  startTimer(room);

  console.log(
    `[Room ${code}] Created by "${nickname}" | ${difficulty} | ${validationMode} | seed: ${seed}`
  );

  return { room, player };
}

export function joinRoom(
  socketId: string,
  nickname: string,
  code: string
): { room: Room; player: Player } | { error: string } {
  const room = rooms.get(code.toUpperCase());

  if (!room) {
    return { error: "Room not found" };
  }

  // Check player limit
  const activePlayers = Array.from(room.players.values()).filter(
    (p) => p.status === "connected"
  );
  if (activePlayers.length >= config.maxPlayersPerRoom) {
    return { error: "Room is full" };
  }

  // Check duplicate nickname
  const existingNames = Array.from(room.players.values()).map(
    (p) => p.nickname.toLowerCase()
  );
  if (existingNames.includes(nickname.toLowerCase())) {
    return { error: "Nickname already taken in this room" };
  }

  // Assign next available color
  const usedColors = new Set(
    Array.from(room.players.values()).map((p) => p.color)
  );
  const color =
    PLAYER_COLORS.find((c) => !usedColors.has(c)) || PLAYER_COLORS[0];

  const playerId = generatePlayerId();
  const sessionToken = generateSessionToken();

  const player: Player = {
    id: playerId,
    socketId,
    nickname,
    color,
    status: "connected",
    disconnectedAt: null,
    sessionToken,
    selectedCell: null,
    notes: new Map(),
    cellsPlaced: 0,
  };

  room.players.set(playerId, player);
  room.lastActivity = Date.now();

  console.log(
    `[Room ${code}] "${nickname}" joined | ${room.players.size} players`
  );

  return { room, player };
}

export function rejoinRoom(
  socketId: string,
  code: string,
  sessionToken: string
): { room: Room; player: Player } | { error: string } {
  const room = rooms.get(code.toUpperCase());

  if (!room) {
    return { error: "Room no longer exists" };
  }

  // Find player by session token
  const player = Array.from(room.players.values()).find(
    (p) => p.sessionToken === sessionToken
  );

  if (!player) {
    return { error: "Session expired, please rejoin" };
  }

  // Restore connection
  player.socketId = socketId;
  player.status = "connected";
  player.disconnectedAt = null;
  room.lastActivity = Date.now();

  console.log(`[Room ${code}] "${player.nickname}" reconnected`);

  return { room, player };
}

// ============================================
// Player disconnect / leave
// ============================================

export function disconnectPlayer(
  socketId: string
): {
  room: Room;
  player: Player;
  creatorChanged: boolean;
  newCreatorId: string | null;
} | null {
  for (const [, room] of rooms) {
    for (const [, player] of room.players) {
      if (player.socketId === socketId && player.status === "connected") {
        player.status = "disconnected";
        player.disconnectedAt = Date.now();
        room.lastActivity = Date.now();

        // Transfer creator role immediately if creator disconnected
        let creatorChanged = false;
        let newCreatorId: string | null = null;

        if (room.creatorId === player.id) {
          const nextCreator = Array.from(room.players.values()).find(
            (p) => p.status === "connected" && p.id !== player.id
          );
          if (nextCreator) {
            room.creatorId = nextCreator.id;
            newCreatorId = nextCreator.id;
            creatorChanged = true;
          }
        }

        console.log(
          `[Room ${room.code}] "${player.nickname}" disconnected${creatorChanged ? ` | creator → "${rooms.get(room.code)?.players.get(newCreatorId!)?.nickname}"` : ""}`
        );

        // Schedule removal after grace period
        schedulePlayerRemoval(room, player.id);

        return { room, player, creatorChanged, newCreatorId };
      }
    }
  }
  return null;
}

export function removePlayer(room: Room, playerId: string): {
  removed: boolean;
  roomDestroyed: boolean;
  newCreatorId: string | null;
} {
  const player = room.players.get(playerId);
  if (!player) return { removed: false, roomDestroyed: false, newCreatorId: null };

  room.players.delete(playerId);

  // Clean up cell owners for this player
  for (const [key, ownerId] of room.cellOwners) {
    if (ownerId === playerId) {
      room.cellOwners.delete(key);
    }
  }

  // Check if room should be destroyed
  const connectedPlayers = Array.from(room.players.values()).filter(
    (p) => p.status === "connected"
  );

  if (room.players.size === 0) {
    destroyRoom(room.code);
    return { removed: true, roomDestroyed: true, newCreatorId: null };
  }

  // Transfer creator if needed
  let newCreatorId: string | null = null;
  if (room.creatorId === playerId && connectedPlayers.length > 0) {
    room.creatorId = connectedPlayers[0].id;
    newCreatorId = connectedPlayers[0].id;
  }

  console.log(
    `[Room ${room.code}] "${player.nickname}" removed | ${room.players.size} players remaining`
  );

  return { removed: true, roomDestroyed: false, newCreatorId };
}

function schedulePlayerRemoval(room: Room, playerId: string): void {
  setTimeout(() => {
    const player = room.players.get(playerId);
    if (player && player.status === "disconnected") {
      const result = removePlayer(room, playerId);
      // Note: socket broadcast for PLAYER_LEFT handled in connectionHandlers
      if (result.roomDestroyed) {
        console.log(`[Room ${room.code}] Destroyed (last player removed)`);
      }
    }
  }, config.reconnectGraceMs);
}

// ============================================
// Timer
// ============================================

function startTimer(room: Room): void {
  if (room.timerInterval) return;
  room.timerInterval = setInterval(() => {
    room.timer++;
  }, 1000);
}

export function resetTimer(room: Room): void {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  room.timer = 0;
  startTimer(room);
}

// ============================================
// Room cleanup
// ============================================

function destroyRoom(code: string): void {
  const room = rooms.get(code);
  if (!room) return;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
  }
  rooms.delete(code);
  console.log(`[Room ${code}] Destroyed`);
}

/**
 * Periodically clean up inactive rooms
 */
export function startCleanupInterval(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.lastActivity > config.roomTimeoutMs) {
        console.log(`[Room ${code}] Timed out (inactive)`);
        destroyRoom(code);
      }
    }
  }, 60_000); // check every minute
}

// ============================================
// Queries
// ============================================

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function getRoomBySocketId(socketId: string): {
  room: Room;
  player: Player;
} | null {
  for (const [, room] of rooms) {
    for (const [, player] of room.players) {
      if (player.socketId === socketId) {
        return { room, player };
      }
    }
  }
  return null;
}

export function getStatus(): {
  activeRooms: number;
  totalPlayers: number;
  uptime: number;
} {
  let totalPlayers = 0;
  for (const [, room] of rooms) {
    totalPlayers += Array.from(room.players.values()).filter(
      (p) => p.status === "connected"
    ).length;
  }
  return {
    activeRooms: rooms.size,
    totalPlayers,
    uptime: process.uptime(),
  };
}
