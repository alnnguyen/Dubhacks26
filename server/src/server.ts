import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server, type Socket } from "socket.io";
import type { Config } from "./config.js";
import type { ClientToServerEvents, ServerToClientEvents } from "./contracts.js";
import { Match } from "./game/match.js";
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

  // Latest socket per player, so a second tab or a reconnect replaces the old one.
  const socketsByPlayerId = new Map<string, GameSocket>();

  // Every state change, whether from a command or a timer, sends each player their own view.
  const match: Match = new Match(MATCH_ROOM, {
    changed: () => {
      for (const [id, socket] of socketsByPlayerId) {
        const slot = sessions.slotOf(id);
        if (slot !== undefined) socket.emit("view", match.toView(slot));
      }
    },
    rockLanded: (event) => io.to(MATCH_ROOM).emit("rockLanded", event),
  });
  const sessions = new Sessions(match);

  io.on("connection", (socket) => {
    let playerId: string | null = null;

    socket.on("join", (request, reply) => {
      if (typeof reply !== "function") return;

      const result = sessions.join(request?.playerId);
      if (!result.ok) {
        reply({ ok: false, reason: result.reason });
        return;
      }
      socket.join(MATCH_ROOM);

      playerId = request.playerId;
      // Record the new socket before closing the old one, so the old socket's
      // disconnect handler sees it was replaced and doesn't start a grace period.
      const previous = socketsByPlayerId.get(playerId);
      socketsByPlayerId.set(playerId, socket);
      if (previous && previous.id !== socket.id) previous.disconnect(true);

      // The join itself already notified everyone else; this player gets their view in the reply.
      reply({ ok: true, slot: result.slot, view: match.toView(result.slot) });
    });

    socket.on("command", (command, reply) => {
      if (typeof reply !== "function") return;

      const slot = playerId === null ? undefined : sessions.slotOf(playerId);
      if (slot === undefined || socketsByPlayerId.get(playerId!) !== socket) {
        reply({ commandId: String(command?.commandId ?? ""), status: "rejected", reason: "not_joined" });
        return;
      }
      reply(match.handleCommand(slot, command));
    });

    socket.on("disconnect", () => {
      // Ignore disconnects from a socket that a newer one already replaced.
      if (playerId === null || socketsByPlayerId.get(playerId) !== socket) return;
      socketsByPlayerId.delete(playerId);
      sessions.disconnect(playerId);
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(config.port, resolve));

  return {
    port: (httpServer.address() as AddressInfo).port,
    // Close sockets first: their disconnect handlers start grace timers that dispose then clears.
    close: () =>
      new Promise((resolve) =>
        io.close(() => {
          match.dispose();
          resolve();
        }),
      ),
  };
}
