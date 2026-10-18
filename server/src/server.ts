import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server, type Socket } from "socket.io";
import { isAllowedOrigin, type Config } from "./config.js";
import type { ClientToServerEvents, ServerToClientEvents } from "./contracts.js";
import { Lobby, type LobbyOptions } from "./sessions/index.js";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface RunningServer {
  port: number;
  close: () => Promise<void>;
}

export async function startServer(config: Config, options: LobbyOptions = {}): Promise<RunningServer> {
  const httpServer = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "text/plain" }).end("ok");
      return;
    }
    res.writeHead(404).end();
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin, config.allowedOrigins));
      },
    },
  });

  // Latest socket per player, so a second tab or a reconnect replaces the old one.
  const socketsByPlayerId = new Map<string, GameSocket>();

  // Every state change, whether from a command or a timer, sends each player
  // their own lobby and match view. A demo room has a handful of players.
  const lobby: Lobby = new Lobby(
    {
      changed: () => {
        for (const [id, socket] of socketsByPlayerId) {
          socket.emit("lobby", lobby.lobbyView(id));
          socket.emit("view", lobby.matchView(id));
        }
      },
      projectileLanded: (playerIds, event) => {
        for (const id of playerIds) socketsByPlayerId.get(id)?.emit("projectileLanded", event);
      },
    },
    options,
  );

  io.on("connection", (socket) => {
    let playerId: string | null = null;

    socket.on("join", (request, reply) => {
      if (typeof reply !== "function") return;

      const result = lobby.join(request?.playerId, request?.callsign);
      if (!result.ok) {
        reply({ ok: false, reason: result.reason });
        return;
      }

      const id: string = request.playerId;
      playerId = id;
      // Record the new socket before closing the old one, so the old socket's
      // disconnect handler sees it was replaced and doesn't mark the pilot gone.
      const previous = socketsByPlayerId.get(id);
      socketsByPlayerId.set(id, socket);
      if (previous && previous.id !== socket.id) previous.disconnect(true);

      reply({ ok: true, lobby: lobby.lobbyView(id), view: lobby.matchView(id) });
    });

    socket.on("command", (command, reply) => {
      if (typeof reply !== "function") return;

      if (playerId === null || socketsByPlayerId.get(playerId) !== socket) {
        reply({ commandId: String(command?.commandId ?? ""), status: "rejected", reason: "not_joined" });
        return;
      }
      reply(lobby.handleCommand(playerId, command));
    });

    socket.on("disconnect", () => {
      // Ignore disconnects from a socket that a newer one already replaced.
      if (playerId === null || socketsByPlayerId.get(playerId) !== socket) return;
      socketsByPlayerId.delete(playerId);
      lobby.disconnect(playerId);
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(config.port, resolve));

  return {
    port: (httpServer.address() as AddressInfo).port,
    // Close sockets first: their disconnect handlers start grace timers that dispose then clears.
    close: () =>
      new Promise((resolve) =>
        io.close(() => {
          lobby.dispose();
          resolve();
        }),
      ),
  };
}
