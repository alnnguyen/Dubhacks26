import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server, type Socket } from "socket.io";
import { isAllowedOrigin, type Config } from "./config.js";
import type { ClientToServerEvents, ServerToClientEvents } from "./contracts.js";
import { createCopilotService, type CopilotOptions } from './integrations/copilot.js';
import { createLyraNarration, type LyraNarrationOptions } from './integrations/lyraNarration.js';
import { Lobby, type LobbyOptions } from "./sessions/index.js";
import { createReplayService, type ReplayOptions } from './integrations/perceptron/replay.js';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface RunningServer {
  port: number;
  close: () => Promise<void>;
}

export async function startServer(config: Config, options: LobbyOptions & { copilot?: CopilotOptions; replay?: ReplayOptions; lyraNarration?: LyraNarrationOptions } = {}): Promise<RunningServer> {
  const replay = createReplayService(options.replay);
  const httpServer = createServer((req, res) => {
    const replayPath = req.url?.match(/^\/replay\/([A-Za-z0-9_-]{1,100})$/);
    if (replayPath) {
      const origin = req.headers.origin;
      if (!isAllowedOrigin(origin, config.allowedOrigins)) { res.writeHead(403).end(); return; }
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Replay-Duration' }).end(); return;
      }
      if (req.method !== 'POST') { res.writeHead(405).end(); return; }
      void replay.handle(req, res, replayPath[1], (actor, match, round) => {
        const view = lobby.matchView(actor);
        return socketsByPlayerId.has(actor) && view?.matchId === match && view.phase === 'finished' && (view.round ?? 1) === round;
      }).catch(() => { if (!res.headersSent) res.writeHead(500).end(); else res.end(); });
      return;
    }
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
  const copilot = createCopilotService(options.copilot);
  const lyraNarration = createLyraNarration(options.lyraNarration);
  // Each pilot's paired phone (their lightsaber). A newer phone replaces the old one.
  const phonesByPlayerId = new Map<string, GameSocket>();

  // Every state change, whether from a command or a timer, sends each player
  // their own lobby and match view. A demo room has a handful of players.
  const lobby: Lobby = new Lobby(
    {
      changed: () => {
        for (const [id, socket] of socketsByPlayerId) {
          socket.emit("lobby", lobby.lobbyView(id));
          socket.emit("view", lobby.matchView(id));
        }
        for (const [id, phone] of phonesByPlayerId) {
          const status = lobby.saberStatus(id);
          if (status) phone.emit("saberStatus", status);
        }
      },
      saberResolved: (playerIds, event) => {
        for (const id of playerIds) {
          socketsByPlayerId.get(id)?.emit("saberResolved", event);
          // Phones play the clash or hit sound.
          phonesByPlayerId.get(id)?.emit("saberResolved", event);
        }
      },
      // Arena frames are superseded by the next tick, so a dropped frame doesn't matter.
      arenaFrame: (playerIds, frame) => {
        for (const id of playerIds) socketsByPlayerId.get(id)?.volatile.emit("arena", frame);
      },
      stepped: (playerIds, event) => {
        for (const id of playerIds) socketsByPlayerId.get(id)?.emit("stepped", event);
      },
    },
    options,
  );

  io.on("connection", (socket) => {
    let playerId: string | null = null;
    // A phone becomes a pilot's saber with their pair code. It controls only
    // that pilot's blade and never joins as a pilot itself.
    let saberOf: string | null = null;

    socket.on('replay:ticket', (request, reply) => {
      if (typeof reply !== 'function') return;
      if (playerId === null || socketsByPlayerId.get(playerId) !== socket) return reply({ ok: false, reason: 'not_joined' });
      if (!request || typeof request !== 'object' || Object.keys(request).length !== 1 || typeof request.matchId !== 'string') return reply({ ok: false, reason: 'invalid_request' });
      const view = lobby.matchView(playerId);
      if (view?.matchId !== request.matchId || view.phase !== 'finished') return reply({ ok: false, reason: 'not_finished' });
      reply(replay.ticket(playerId, view.matchId, view.round ?? 1));
    });

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

    // Both requests use the same joined socket identity as game commands, not an actor ID from the browser.
    socket.on('copilot:session', async (request, reply) => {
      if (typeof reply !== 'function') return;
      if (playerId === null || socketsByPlayerId.get(playerId) !== socket) return reply({ ok: false, reason: 'not_joined' });
      if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).length) return reply({ ok: false, reason: 'invalid_request' });
      const actor = playerId;
      const result = await copilot.open(actor);
      reply(socketsByPlayerId.get(actor) === socket && playerId === actor ? result : { ok: false, reason: 'not_joined' });
    });
    socket.on('copilot:context', (request, reply) => {
      if (typeof reply !== 'function') return;
      if (playerId === null || socketsByPlayerId.get(playerId) !== socket) return reply({ ok: false, reason: 'not_joined' });
      if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).length) return reply({ ok: false, reason: 'invalid_request' });
      reply({ ok: true, context: { source: 'live', lobby: lobby.lobbyView(playerId), match: lobby.matchView(playerId) } });
    });
    socket.on('lyra:narrate', async (request, reply) => {
      if (typeof reply !== 'function') return;
      if (playerId === null || socketsByPlayerId.get(playerId) !== socket) return reply({ ok: false, reason: 'not_joined' });
      if (!request || typeof request !== 'object' || Array.isArray(request) || typeof (request as { cue?: unknown }).cue !== 'string') {
        return reply({ ok: false, reason: 'invalid_request' });
      }
      const actor = playerId;
      const result = await lyraNarration.speak(actor, (request as { cue: string }).cue);
      reply(socketsByPlayerId.get(actor) === socket && playerId === actor ? result : { ok: false, reason: 'not_joined' });
    });

    socket.on("bodyPose", (pose) => {
      if (playerId === null || socketsByPlayerId.get(playerId) !== socket) return;
      lobby.handleBodyPose(playerId, pose);
    });

    socket.on("pairSaber", (request, reply) => {
      if (typeof reply !== "function") return;
      const owner = lobby.pairSaber(request?.code);
      if (owner === null) {
        reply({ ok: false, reason: "invalid_code" });
        return;
      }
      saberOf = owner;
      // Record the new phone before dropping the old one, so the old phone's
      // disconnect handler sees it was replaced and doesn't unpair.
      const previous = phonesByPlayerId.get(owner);
      phonesByPlayerId.set(owner, socket);
      if (previous && previous.id !== socket.id) previous.disconnect(true);
      reply({ ok: true, status: lobby.saberStatus(owner)! });
    });

    socket.on("saberAim", (aim) => {
      if (saberOf === null || phonesByPlayerId.get(saberOf) !== socket) return;
      const accepted = lobby.handleSaberAim(saberOf, aim);
      // The pilot's laptop checks the phone's readings during setup.
      if (accepted) socketsByPlayerId.get(saberOf)?.volatile.emit("phoneAim", accepted);
    });

    // A thumb swipe on the phone: a step for the pilot it's paired to, through the normal command path.
    socket.on("saberStep", (request, reply) => {
      if (typeof reply !== "function") return;
      const stepId = String(request?.stepId ?? "");
      if (saberOf === null || phonesByPlayerId.get(saberOf) !== socket) {
        reply({ commandId: stepId, status: "rejected", reason: "not_joined" });
        return;
      }
      reply(lobby.handleCommand(saberOf, { commandId: stepId, type: "step", direction: request?.direction }));
    });

    socket.on("disconnect", () => {
      // Ignore disconnects from a socket that a newer one already replaced.
      if (saberOf !== null && phonesByPlayerId.get(saberOf) === socket) {
        phonesByPlayerId.delete(saberOf);
        lobby.unpairSaber(saberOf);
      }
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
