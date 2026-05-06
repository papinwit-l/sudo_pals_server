import { Server } from "socket.io";
import { registerRoomHandlers } from "./handlers/roomHandlers";
import { registerGameHandlers } from "./handlers/gameHandlers";
import { registerConnectionHandlers } from "./handlers/connectionHandlers";

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket) => {
    console.log(`[Socket] ${socket.id} connected`);

    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerConnectionHandlers(io, socket);
  });
}
