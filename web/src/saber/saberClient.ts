import { io } from "socket.io-client";
import { gameServerUrl } from "../networking/gameEndpoint";
import type { SocketLike } from "../networking/gameClient";
import type {
  CommandReply,
  PairReply,
  SaberAim,
  SaberResolved,
  SaberStatus,
  StepDirection,
} from "../../../server/src/contracts";

export type SaberConnection =
  | "connecting"
  | "paired"
  | "invalid_code"
  | "offline";

export interface SaberClient {
  connection(): SaberConnection;
  /** Why the last connection attempt failed, while offline. Socket.IO keeps retrying. */
  error(): string | null;
  status(): SaberStatus | null;
  onChange(listener: () => void): () => void;
  onResolved(listener: (event: SaberResolved) => void): () => void;
  /** ~30 Hz, no reply; dropped while not paired. This module numbers them. */
  sendAim(aim: Omit<SaberAim, "seq">): void;
  /** A thumb swipe: one step for this phone's pilot. Resolves with the server's reply, or offline when not paired. */
  step(direction: StepDirection): Promise<CommandReply | { status: "offline" }>;
  close(): void;
}

/**
 * The phone's connection: it presents the pilot's pair code (again after every
 * reconnect) and then streams that pilot's saber aim. It never joins as a pilot.
 */
export function createSaberClient(
  code: string,
  createSocket: (url?: string) => SocketLike & {
    emit(event: string, payload: unknown, ack?: (reply: any) => void): unknown;
  } = (url) => io(url),
): SaberClient {
  const socket = createSocket(gameServerUrl());
  let connection: SaberConnection = "connecting";
  let error: string | null = null;
  let status: SaberStatus | null = null;
  // Page-load time, so aims after a reload are newer than any before it.
  let nextSeq = Date.now();
  // Swipe ids from page-load time too, so a reload never reuses one the server already answered.
  let nextStep = Date.now();
  const changeListeners = new Set<() => void>();
  const resolvedListeners = new Set<(event: SaberResolved) => void>();
  const changed = () => changeListeners.forEach((listener) => listener());

  socket.on("connect", () => {
    connection = "connecting";
    error = null;
    changed();
    socket
      .timeout(3000)
      .emit("pairSaber", { code }, (err: Error | null, reply: PairReply) => {
        if (err) {
          connection = "offline";
          error = "The game server didn't answer the pairing request.";
        } else if (!reply.ok) connection = "invalid_code";
        else {
          connection = "paired";
          status = reply.status;
        }
        changed();
      });
  });
  socket.on("disconnect", () => {
    connection = "offline";
    changed();
  });
  socket.on("connect_error", (err: Error) => {
    connection = "offline";
    error = err?.message || "Can't reach the game server.";
    changed();
  });
  socket.on("saberStatus", (next: SaberStatus) => {
    status = next;
    changed();
  });
  socket.on("saberResolved", (event: SaberResolved) =>
    resolvedListeners.forEach((listener) => listener(event)),
  );

  return {
    connection: () => connection,
    error: () => error,
    status: () => status,
    onChange: (listener) => {
      changeListeners.add(listener);
      return () => void changeListeners.delete(listener);
    },
    onResolved: (listener) => {
      resolvedListeners.add(listener);
      return () => void resolvedListeners.delete(listener);
    },
    sendAim: (aim) => {
      if (connection !== "paired" || !socket.connected) return;
      socket.volatile.emit("saberAim", { ...aim, seq: nextSeq++ });
    },
    step: (direction) => {
      if (connection !== "paired" || !socket.connected)
        return Promise.resolve({ status: "offline" as const });
      const stepId = `s${nextStep++}`;
      return new Promise((resolve) => {
        socket
          .timeout(3000)
          .emit(
            "saberStep",
            { stepId, direction },
            (err: Error | null, reply: CommandReply) => {
              resolve(err ? { status: "offline" } : reply);
            },
          );
      });
    },
    close: () => void socket.disconnect(),
  };
}
