import { Server, Socket } from "socket.io";
import { disconnectPlayer } from "../../rooms/roomManager";

export function registerConnectionHandlers(io: Server, socket: Socket): void {
  socket.on("disconnect", (reason) => {
    console.log(`[Socket] ${socket.id} disconnected (${reason})`);

    const result = disconnectPlayer(socket.id);

    if (!result) return;

    const { room, player, creatorChanged, newCreatorId } = result;

    // Notify remaining players
    socket.to(room.code).emit("PLAYER_DISCONNECTED", {
      playerId: player.id,
    });

    // If creator changed, notify
    if (creatorChanged && newCreatorId) {
      socket.to(room.code).emit("PLAYER_LEFT", {
        playerId: player.id,
        newCreatorId,
      });
    }
  });

  // ---- LEAVE_ROOM ---- (explicit leave, not just disconnect)
  socket.on("LEAVE_ROOM", () => {
    const result = disconnectPlayer(socket.id);

    if (!result) return;

    const { room, player, creatorChanged, newCreatorId } = result;

    // Leave socket.io room
    socket.leave(room.code);

    // For explicit leave, remove immediately (don't wait for grace period)
    // The player chose to leave, so no reconnection expected
    const { removePlayer } = require("../../rooms/roomManager");
    const removeResult = removePlayer(room, player.id);

    if (!removeResult.roomDestroyed) {
      io.to(room.code).emit("PLAYER_LEFT", {
        playerId: player.id,
        newCreatorId: removeResult.newCreatorId,
      });
    }
  });
}
