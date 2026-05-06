import {
  Board,
  Player,
  Room,
  SerializedBoard,
  SerializedPlayer,
  PlayerStats,
} from "../types/sudoku";

/**
 * Serialize board for transport — strips notes (private per player)
 */
export function serializeBoard(board: Board): SerializedBoard {
  return board.map((row) =>
    row.map((cell) => ({
      value: cell.value,
      isFixed: cell.isFixed,
      isError: cell.isError,
    }))
  );
}

/**
 * Serialize a player for transport
 */
export function serializePlayer(player: Player): SerializedPlayer {
  return {
    id: player.id,
    nickname: player.nickname,
    color: player.color,
    status: player.status,
    selectedCell: player.selectedCell,
    cellsPlaced: player.cellsPlaced,
  };
}

/**
 * Serialize all players in a room
 */
export function serializePlayers(room: Room): SerializedPlayer[] {
  return Array.from(room.players.values()).map(serializePlayer);
}

/**
 * Serialize a player's notes for transport — Map<string, Set> → Record<string, number[]>
 */
export function serializeNotes(
  notes: Map<string, Set<number>>
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const [key, set] of notes) {
    result[key] = Array.from(set);
  }
  return result;
}

/**
 * Serialize cell owners — Map<string, string> → Record<string, string>
 */
export function serializeCellOwners(
  cellOwners: Map<string, string>
): Record<string, string> {
  return Object.fromEntries(cellOwners);
}

/**
 * Get completion stats for all players
 */
export function getPlayerStats(room: Room): PlayerStats[] {
  return Array.from(room.players.values()).map((player) => ({
    playerId: player.id,
    nickname: player.nickname,
    color: player.color,
    cellsPlaced: player.cellsPlaced,
  }));
}
