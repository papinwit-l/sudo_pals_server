// ============================================
// Core Sudoku types (shared with frontend)
// ============================================

export type CellValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | null;

export type Cell = {
  value: CellValue;
  isFixed: boolean;
  notes: Set<number>;
  isError: boolean;
};

export type Board = Cell[][];

export type Difficulty = "easy" | "medium" | "hard";

export type Position = {
  row: number;
  col: number;
};

// ============================================
// Multiplayer types (server only)
// ============================================

export type ValidationMode = "conflict" | "strict";

export type PlayerColor =
  | "indigo"
  | "rose"
  | "emerald"
  | "amber"
  | "cyan"
  | "purple"
  | "orange"
  | "teal";

export const PLAYER_COLORS: PlayerColor[] = [
  "indigo",
  "rose",
  "emerald",
  "amber",
  "cyan",
  "purple",
  "orange",
  "teal",
];

export type PlayerStatus = "connected" | "disconnected";

export type Player = {
  id: string;
  socketId: string;
  nickname: string;
  color: PlayerColor;
  status: PlayerStatus;
  disconnectedAt: number | null;
  sessionToken: string;
  selectedCell: Position | null;
  notes: Map<string, Set<number>>; // "row,col" -> Set<number>
  cellsPlaced: number; // for completion stats
};

export type Room = {
  code: string;
  board: Board;
  solution: CellValue[][]; // solved board values only
  difficulty: Difficulty;
  seed: number;
  isCustomSeed: boolean;
  validationMode: ValidationMode;
  players: Map<string, Player>; // playerId -> Player
  creatorId: string;
  timer: number; // seconds elapsed
  timerInterval: NodeJS.Timeout | null;
  lastActivity: number; // timestamp for inactivity cleanup
  cellOwners: Map<string, string>; // "row,col" -> playerId
};

// ============================================
// Socket event types
// ============================================

// Client → Server
export interface ClientEvents {
  CREATE_ROOM: {
    nickname: string;
    difficulty: Difficulty;
    seed?: number;
    validationMode: ValidationMode;
  };
  JOIN_ROOM: {
    nickname: string;
    code: string;
  };
  REJOIN_ROOM: {
    code: string;
    sessionToken: string;
  };
  PLACE_NUMBER: {
    row: number;
    col: number;
    value: CellValue;
  };
  CLEAR_CELL: {
    row: number;
    col: number;
  };
  SELECT_CELL: {
    row: number;
    col: number;
  };
  NEW_GAME: {
    difficulty: Difficulty;
    seed?: number;
    validationMode?: ValidationMode;
  };
  LEAVE_ROOM: {};
}

// Server → Client
export interface ServerEvents {
  ROOM_CREATED: {
    code: string;
    seed: number;
    difficulty: Difficulty;
    board: SerializedBoard;
    isCustomSeed: boolean;
    validationMode: ValidationMode;
    sessionToken: string;
    playerId: string;
    nickname: string;
    color: PlayerColor;
  };
  ROOM_JOINED: {
    board: SerializedBoard;
    players: SerializedPlayer[];
    seed: number;
    difficulty: Difficulty;
    timer: number;
    isCustomSeed: boolean;
    validationMode: ValidationMode;
    sessionToken: string;
    playerId: string;
    color: PlayerColor;
    cellOwners: Record<string, string>;
  };
  PLAYER_JOINED: {
    playerId: string;
    nickname: string;
    color: PlayerColor;
  };
  PLAYER_LEFT: {
    playerId: string;
    newCreatorId: string | null;
  };
  PLAYER_DISCONNECTED: {
    playerId: string;
  };
  PLAYER_RECONNECTED: {
    playerId: string;
  };
  ROOM_STATE: {
    code: string;
    board: SerializedBoard;
    players: SerializedPlayer[];
    timer: number;
    difficulty: Difficulty;
    seed: number;
    isCustomSeed: boolean;
    validationMode: ValidationMode;
    yourNotes: Record<string, number[]>;
    cellOwners: Record<string, string>;
  };
  ROOM_EXPIRED: {};
  BOARD_UPDATED: {
    row: number;
    col: number;
    value: CellValue;
    playerId: string;
    isError: boolean;
  };
  CELL_CLEARED: {
    row: number;
    col: number;
    playerId: string;
  };
  CELL_SELECTED: {
    row: number;
    col: number;
    playerId: string;
  };
  GAME_COMPLETE: {
    stats: PlayerStats[];
    time: number;
  };
  NEW_GAME_STARTED: {
    board: SerializedBoard;
    seed: number;
    difficulty: Difficulty;
    isCustomSeed: boolean;
    validationMode: ValidationMode;
  };
  ERROR: {
    message: string;
  };
}

// ============================================
// Serialization types (for transport over socket)
// ============================================

export type SerializedCell = {
  value: CellValue;
  isFixed: boolean;
  isError: boolean;
};

export type SerializedBoard = SerializedCell[][];

export type SerializedPlayer = {
  id: string;
  nickname: string;
  color: PlayerColor;
  status: PlayerStatus;
  selectedCell: Position | null;
  cellsPlaced: number;
};

export type PlayerStats = {
  playerId: string;
  nickname: string;
  color: PlayerColor;
  cellsPlaced: number;
};
