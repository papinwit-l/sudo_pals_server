import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",

  // Room limits
  maxRooms: parseInt(process.env.MAX_ROOMS || "50"),
  maxPlayersPerRoom: parseInt(process.env.MAX_PLAYERS_PER_ROOM || "8"),
  roomTimeoutMs: parseInt(process.env.ROOM_TIMEOUT_MS || "1800000"), // 30 min

  // Reconnection
  reconnectGraceMs: parseInt(process.env.RECONNECT_GRACE_MS || "120000"), // 2 min

  // Socket.io
  pingIntervalMs: parseInt(process.env.PING_INTERVAL_MS || "25000"),
  pingTimeoutMs: parseInt(process.env.PING_TIMEOUT_MS || "20000"),
};
