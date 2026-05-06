import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { config } from "./config";
import { setupSocketHandlers } from "./socket";
import { startCleanupInterval, getStatus } from "./rooms/roomManager";

// ============================================
// Express app
// ============================================

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// Health check (for UptimeRobot / Render keep-alive)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Server status
app.get("/status", (_req, res) => {
  res.json(getStatus());
});

// ============================================
// HTTP + Socket.io server
// ============================================

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"],
  },
  pingInterval: config.pingIntervalMs,
  pingTimeout: config.pingTimeoutMs,
});

// ============================================
// Register socket handlers
// ============================================

setupSocketHandlers(io);

// ============================================
// Start
// ============================================

startCleanupInterval();

server.listen(config.port, () => {
  console.log(`\n🎲 SudoPals server running on port ${config.port}`);
  console.log(`   CORS origin: ${config.corsOrigin}`);
  console.log(`   Max rooms: ${config.maxRooms}`);
  console.log(`   Max players/room: ${config.maxPlayersPerRoom}`);
  console.log(`   Room timeout: ${config.roomTimeoutMs / 1000}s`);
  console.log(`   Reconnect grace: ${config.reconnectGraceMs / 1000}s\n`);
});
