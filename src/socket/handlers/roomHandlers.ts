import { Server, Socket } from "socket.io";
import { createRoom, joinRoom, rejoinRoom } from "../../rooms/roomManager";
import {
  serializeBoard,
  serializePlayers,
  serializeNotes,
  serializeCellOwners,
} from "../../utils/serialize";
import { ClientEvents, Difficulty, ValidationMode } from "../../types/sudoku";

export function registerRoomHandlers(io: Server, socket: Socket): void {
  // ---- CREATE_ROOM ----
  socket.on("CREATE_ROOM", (data: ClientEvents["CREATE_ROOM"]) => {
    const { nickname, difficulty, seed, validationMode } = data;

    // Basic validation
    if (!nickname || nickname.trim().length === 0) {
      socket.emit("ERROR", { message: "Nickname is required" });
      return;
    }
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      socket.emit("ERROR", { message: "Invalid difficulty" });
      return;
    }
    if (!["conflict", "strict"].includes(validationMode)) {
      socket.emit("ERROR", { message: "Invalid validation mode" });
      return;
    }

    const result = createRoom(
      socket.id,
      nickname.trim(),
      difficulty as Difficulty,
      validationMode as ValidationMode,
      seed,
    );

    if ("error" in result) {
      socket.emit("ERROR", { message: result.error });
      return;
    }

    const { room, player } = result;

    // Join socket.io room
    socket.join(room.code);

    socket.emit("ROOM_CREATED", {
      code: room.code,
      seed: room.seed,
      difficulty: room.difficulty,
      board: serializeBoard(room.board),
      isCustomSeed: room.isCustomSeed,
      validationMode: room.validationMode,
      sessionToken: player.sessionToken,
      playerId: player.id,
      nickname: player.nickname,
      color: player.color,
    });
  });

  // ---- JOIN_ROOM ----
  socket.on("JOIN_ROOM", (data: ClientEvents["JOIN_ROOM"]) => {
    const { nickname, code } = data;

    if (!nickname || nickname.trim().length === 0) {
      socket.emit("ERROR", { message: "Nickname is required" });
      return;
    }
    if (!code || code.trim().length === 0) {
      socket.emit("ERROR", { message: "Room code is required" });
      return;
    }

    const result = joinRoom(socket.id, nickname.trim(), code.trim());

    if ("error" in result) {
      socket.emit("ERROR", { message: result.error });
      return;
    }

    const { room, player } = result;

    // Join socket.io room
    socket.join(room.code);

    // Send full state to the joining player
    socket.emit("ROOM_JOINED", {
      code: room.code,
      board: serializeBoard(room.board),
      players: serializePlayers(room),
      seed: room.seed,
      difficulty: room.difficulty,
      timer: room.timer,
      isCustomSeed: room.isCustomSeed,
      validationMode: room.validationMode,
      sessionToken: player.sessionToken,
      playerId: player.id,
      color: player.color,
      cellOwners: serializeCellOwners(room.cellOwners),
    });

    // Notify other players
    socket.to(room.code).emit("PLAYER_JOINED", {
      playerId: player.id,
      nickname: player.nickname,
      color: player.color,
    });
  });

  // ---- REJOIN_ROOM ----
  socket.on("REJOIN_ROOM", (data: ClientEvents["REJOIN_ROOM"]) => {
    const { code, sessionToken } = data;

    if (!code || !sessionToken) {
      socket.emit("ERROR", { message: "Missing rejoin credentials" });
      return;
    }

    const result = rejoinRoom(socket.id, code, sessionToken);

    if ("error" in result) {
      // If room expired, tell client explicitly
      if (result.error === "Room no longer exists") {
        socket.emit("ROOM_EXPIRED", {});
      } else {
        socket.emit("ERROR", { message: result.error });
      }
      return;
    }

    const { room, player } = result;

    // Rejoin socket.io room
    socket.join(room.code);

    // Send current state to reconnected player
    socket.emit("ROOM_STATE", {
      code: room.code,
      board: serializeBoard(room.board),
      players: serializePlayers(room),
      timer: room.timer,
      difficulty: room.difficulty,
      seed: room.seed,
      isCustomSeed: room.isCustomSeed,
      validationMode: room.validationMode,
      yourNotes: serializeNotes(player.notes),
      cellOwners: serializeCellOwners(room.cellOwners),
    });

    // Notify others
    socket.to(room.code).emit("PLAYER_RECONNECTED", {
      playerId: player.id,
    });
  });
}
