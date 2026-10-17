import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server, type Socket } from "socket.io";
import type { Config } from "./config.js";
import type { ClientToServerEvents, ServerToClientEvents } from "./contracts.js";
import { createMatch, toSnapshot } from "./game/match.js";
import { Sessions } from "./sessions/index.js";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const MATCH_ROOM = "demo-match";

export interface RunningServer {
  port: number;
  close: () => Promise<void>;
}

export async function startServer(config: Config): Promise<RunningServer> {
  const httpServer = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }
    res.writeHead(404).end();
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: config.allowedOrigins },
  });

  const match = createMatch(MATCH_ROOM);
  const sessions = new Sessions(match);
  // Latest socket per player, so a second tab or a reconnect replaces the old one.
  const socketsByPlayerId = new Map<string, GameSocket>();

  const broadcast = () => io.to(MATCH_ROOM).emit("snapshot", toSnapshot(match));

  io.on("connection", (socket) => {
    let playerId: string | null = null;

    socket.on("join", (request, reply) => {
      if (typeof reply !== "function") return;

      const result = sessions.join(request?.playerId);
      if (!result.ok) {
        reply({ ok: false, reason: result.reason });
        return;
      }

      playerId = request.playerId;
      const previous = socketsByPlayerId.get(playerId);
      if (previous && previous.id !== socket.id) previous.disconnect(true);
      socketsByPlayerId.set(playerId, socket);

      socket.join(MATCH_ROOM);
      reply({ ok: true, slot: result.slot, snapshot: toSnapshot(match) });
      broadcast();
    });

    socket.on("disconnect", () => {
      // Ignore disconnects from a socket that a newer one already replaced.
      if (playerId === null || socketsByPlayerId.get(playerId) !== socket) return;
      socketsByPlayerId.delete(playerId);
      sessions.disconnect(playerId);
      broadcast();
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(config.port, resolve));

  return {
    port: (httpServer.address() as AddressInfo).port,
    close: () => new Promise((resolve) => io.close(() => resolve())),
  };
}
