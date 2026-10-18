import { destinationFromWorld } from '../destinations/config';
import { BattleHud } from "./BattleHud";
import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import QRCode from "qrcode";
import type {
  ArenaFrame,
  PlayerView,
  SaberAim,
  SaberStart,
  StepDirection,
  Vec3,
} from "../../../server/src/contracts";
import type { GameClient } from "../networking";
import { saberControllerUrl } from "../networking/gameEndpoint";
import { gameAudio } from "../audio/gameAudio";
import { WASM_ROOT } from "../camera/mediapipeVision";
import { placement, worldToBody } from "./bodyFrame";
import { createArenaBuffer, pushFrame, sampleFrame } from "./arenaBuffer";
import { createStabilizer, stabilize } from "./bodyStabilizer";
import { withLocalFighter, withSetupBody } from "./localFighter";
import { glideRoot, onOwnStep, reconcile, type OwnGlide } from "./ownGlide";
import { ArenaScene, type ImpactFlash } from "./ArenaScene";
import {
  applyCameraFix,
  calibrationOf,
  createWizard,
  mirrorIndex,
  phoneInBody,
  tickWizard,
  type WizardState,
} from "./setupWizard";
import "./arena3d.css";
import { SaberInitiation, SaberCountdown, saberCountdown } from "./SaberInitiation";
import { IDLE_HOLD, TRACKING_GRACE_MS, holdsFight, tickFightHold, trackingLossNote, type FightHold } from "./fightHold";
import { useLyraArenaSpeak } from "./useLyraArenaSpeak";

/** Keep renderer failures from taking down the match controls. */
class ArenaRenderBoundary extends Component<{ children: ReactNode; onLeave: () => void; onBasic: () => void }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error: Error) { console.error('Arena renderer failed', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <section className="arena-setup" style={{ zIndex: 10 }} role="alert">
      <h2>Arena graphics could not load</h2>
      <p>Your match is still connected. Try the simple arena or return to the cockpit.</p>
      <div className="arena-setup-actions">
        <button onClick={this.props.onBasic}>Use simple arena</button>{' '}
        <button onClick={this.props.onLeave}>Return to cockpit</button>
      </div>
    </section>;
  }
}

// The full model's 3D world landmarks are steadier than lite's, and a laptop can afford it.
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
// As often as the server ticks, so the hilt (wrist) is never a tick behind.
const BODY_SEND_MS = 33;
// A phone reading older than this doesn't count for setup checks.
const PHONE_FRESH_MS = 300;

/** Body tracking, GPU first. */
async function createPoseTracker(): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_ROOT);
  const create = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  try {
    return await create("GPU");
  } catch {
    return await create("CPU");
  }
}

/** Keyboard fallback: one step per press of WASD or an arrow key. */
const STEP_KEYS: Record<string, StepDirection> = {
  w: "forward",
  arrowup: "forward",
  s: "back",
  arrowdown: "back",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};
const TOAST_MS = 900;

/**
 * The lightsaber duel on a laptop: the laptop camera tracks your body, your
 * paired phone is the saber, and the shared 3D arena shows both fighters from
 * over your shoulder. A guided setup links the two devices first (see
 * setupWizard); swings only count once both players finish it. The server
 * judges every swing.
 */
export function ArenaDuel({
  client,
  view,
  pairCode,
  note,
  onLeave,
  onForfeit,
  onRematch,
  replayEnabled = false,
  onReplayEnabled,
  onReplaySource,
  resultExtra,
}: {
  client: GameClient;
  view: PlayerView;
  pairCode: string;
  note: string;
  /** Back to the cockpit; before the end this forfeits. */
  onLeave: () => void;
  /** Give the round to the rival and go to the result screen. */
  onForfeit: () => void;
  /** On the result screen: play again, keeping the camera and saber setup. */
  onRematch: () => void;
  resultExtra?: ReactNode;
  replayEnabled?: boolean;
  onReplayEnabled?: (enabled: boolean) => void;
  onReplaySource?: (video: HTMLVideoElement) => () => void;
}) {
  const [basicGraphics, setBasicGraphics] = useState(false);
  const [renderAttempt, setRenderAttempt] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Latest raw frame (for effect positions) and the buffer the scene plays back smoothly.
  const frameRef = useRef<ArenaFrame | null>(null);
  const bufferRef = useRef(createArenaBuffer());
  // This laptop's own body and phone reading, to draw your fighter without the server round trip.
  const ownRef = useRef<{
    joints: Vec3[] | null;
    bodyAtMs: number;
    top: Vec3 | null;
    topAtMs: number;
  }>({ joints: null, bodyAtMs: 0, top: null, topAtMs: 0 });
  const slotRef = useRef(view.you.slot);
  slotRef.current = view.you.slot;
  const flashRef = useRef<ImpactFlash | null>(null);
  const wizardRef = useRef<WizardState>(createWizard(performance.now()));
  const phoneRef = useRef<{ aim: SaberAim; atMs: number } | null>(null);
  const sentCalibrationRef = useRef("");
  const [wizard, setWizard] = useState<WizardState>(wizardRef.current);
  const paintedWizardRef = useRef(wizardRef.current);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bodySeen, setBodySeen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  // Your own step glide, started the moment the server accepts a step (see ownGlide).
  const ownGlideRef = useRef<OwnGlide | null>(null);
  const boardRef = useRef(view.board);
  boardRef.current = view.board;
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [engaged, setEngaged] = useState(false);
  const [saberStart, setSaberStart] = useState<SaberStart | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [serverFresh, setServerFresh] = useState(false);
  const arenaReceivedAt = useRef<number | null>(null);
  const mayStep = useRef(false);
  useEffect(() => {
    const id = window.setInterval(() => {
      const received = arenaReceivedAt.current;
      const frame = frameRef.current;
      const now = performance.now();
      const fresh = received !== null && now - received < 1500;
      setServerFresh(fresh);
      setCountdown(fresh && frame && received !== null
        ? saberCountdown(frame.saberStart ?? null, frame.serverMs + now - received) : null);
    }, 80);
    return () => window.clearInterval(id);
  }, []);


  const showToast = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // Flicks and keys both go through the server's validated step command.
  const step = useCallback(
    (direction: StepDirection) => {
      if (!mayStep.current) return;
      void client.step(direction).then((reply) => {
        if (reply.status !== "rejected") return;
        if (reply.reason === "exhausted") showToast("Out of stamina");
        else if (reply.reason === "stunned") showToast("Stunned");
        else if (reply.reason === "blocked")
          showToast(
            direction === "forward" ? "Your rival is there" : "Edge of the arena",
          );
      });
    },
    [client, showToast],
  );
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      const direction = STEP_KEYS[event.key.toLowerCase()];
      if (
        !direction ||
        event.repeat ||
        event.target instanceof HTMLInputElement
      )
        return;
      event.preventDefault();
      stepRef.current(direction);
    };
    window.addEventListener("keydown", onDown);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.clearTimeout(toastTimer.current);
    };
  }, []);
  const { you, rival } = view;
  const saberUrl = saberControllerUrl(pairCode);

  useEffect(() => {
    if (!pairCode) return;
    let cancelled = false;
    QRCode.toDataURL(saberUrl, { margin: 1, width: 220 })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [saberUrl, pairCode]);

  useEffect(() => {
    const offArena = client.onArena((frame) => {
      frameRef.current = frame;
      arenaReceivedAt.current = performance.now();
      const start = frame.saberStart ?? null;
      setSaberStart(old => old?.startsAtMs === start?.startsAtMs && old?.unlocked === start?.unlocked ? old : start);
      setEngaged(frame.engaged);
      bufferRef.current = pushFrame(
        bufferRef.current,
        frame,
        performance.now(),
      );
    });
    // Your own accepted steps start gliding right away, ahead of the frames.
    const offStepped = client.onStepped((event) => {
      if (event.slot !== slotRef.current) return;
      const { cellSize, stepMs } = boardRef.current;
      ownGlideRef.current = onOwnStep(
        ownGlideRef.current,
        event.cell,
        cellSize,
        stepMs,
        performance.now(),
        event.orbitCenter,
      );
    });
    const offPhone = client.onPhoneAim((aim) => {
      const now = performance.now();
      phoneRef.current = { aim, atMs: now };
      if (aim.tracked)
        ownRef.current = { ...ownRef.current, top: aim.top, topAtMs: now };
    });
    // Clash sparks between the blades; a hit flashes at the defender's chest.
    const offResolved = client.onSaberResolved((event) => {
      // Hit layers clash underneath — contact + damage land together.
      if (event.outcome === "blocked") gameAudio.play("saberBlock");
      else if (event.outcome === "guardBreak") gameAudio.play("saberClash");
      else {
        gameAudio.play("saberHit");
        gameAudio.play("saberClash", 0.55);
      }
      const players = frameRef.current?.players ?? [];
      const attacker = players.find((p) => p.slot === event.attackerSlot);
      const defender = players.find((p) => p.slot !== event.attackerSlot);
      let at: Vec3 | null = null;
      if (event.outcome !== "hit" && attacker?.blade && defender?.blade) {
        at = midpoint(
          midpoint(attacker.blade.hilt, attacker.blade.tip),
          midpoint(defender.blade.hilt, defender.blade.tip),
        );
      } else if (defender?.joints) {
        at = midpoint(defender.joints[11], defender.joints[12]);
      }
      if (at)
        flashRef.current = {
          kind: event.outcome,
          at,
          startedMs: performance.now(),
        };
    });
    return () => {
      offArena();
      offStepped();
      offPhone();
      offResolved();
    };
  }, [client, showToast]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let raf = 0;
    let tracker: PoseLandmarker | null = null;
    let stream: MediaStream | null = null;
    let lastVideoTime = -1;
    let lastSent = 0;
    let stabilizer = createStabilizer();

    function loop() {
      const video = videoRef.current;
      if (cancelled || !video || !tracker) return;
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const now = performance.now();
        const result = tracker.detectForVideo(video, now);
        const world = result.worldLandmarks[0];
        const image = result.landmarks[0];
        const aspect = video.videoWidth / video.videoHeight || 16 / 9;
        const place = placement(image, aspect);

        // Setup's camera fix corrects a mirrored or depth-reversed camera before anything uses the body;
        // the stabilizer then keeps only head, torso and arms, smoothed.
        const before = wizardRef.current;
        const { mirrorX } = before.cameraFix;
        let body: Vec3[] | null = null;
        if (world && image) {
          const fixed = applyCameraFix(
            world.map(worldToBody),
            before.cameraFix,
          );
          const visibility = fixed.map(
            (_, i) => image[mirrorIndex(i, mirrorX)]?.visibility ?? 0,
          );
          const stable = stabilize(stabilizer, fixed, visibility, now);
          stabilizer = stable.state;
          body = stable.joints;
          ownRef.current = { ...ownRef.current, joints: body, bodyAtMs: performance.now() };
        } else {
          ownRef.current = { ...ownRef.current, joints: null, bodyAtMs: 0 };
          stabilizer = createStabilizer();
        }

        setBodySeen(body !== null);

        // The free hand, matched to where the body tracker sees the free wrist.

        const phone = phoneRef.current;
        const freshPhone =
          phone && phone.aim.tracked && now - phone.atMs <= PHONE_FRESH_MS
            ? phone.aim
            : null;
        const wizard = tickWizard(before, {
          nowMs: now,
          body,
          placement: place,
          phone: freshPhone,
        });
        wizardRef.current = wizard;
        if (
          wizard.step !== paintedWizardRef.current.step ||
          Math.abs(wizard.progress - paintedWizardRef.current.progress) >= 0.04 ||
          (wizard.progress === 0 && paintedWizardRef.current.progress !== 0)
        ) {
          paintedWizardRef.current = wizard;
          setWizard(wizard);
        }

        // Each time setup measures something new, store it on the server so the blade follows it.
        const calibration = calibrationOf(wizard);
        const key = JSON.stringify(calibration);
        if (calibration && key !== sentCalibrationRef.current) {
          sentCalibrationRef.current = key;
          void client.calibrateSaber(calibration).then((reply) => {
            if (reply.status === "rejected") sentCalibrationRef.current = "";
          });
        }

        if (now - lastSent >= BODY_SEND_MS) {
          lastSent = now;
          client.sendBodyPose({
            tracked: body !== null,
            joints: body ?? [],
            calibrated: wizard.baseline !== null,
            setup: { step: wizard.step, progress: wizard.progress },
          });
        }
      }
      raf = requestAnimationFrame(loop);
    }

    async function start() {
      setLoading(true);
      setError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        tracker = await createPoseTracker();
        if (cancelled) return;
        setLoading(false);
        loop();
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        setRunning(false);
        setError(
          err instanceof Error ? err.message : "Couldn't start the camera.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      tracker?.close();
      ownRef.current = { ...ownRef.current, joints: null, bodyAtMs: 0 };
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [running, client]);

  // What the scene draws each frame: server frames played back smoothly, with your own fighter drawn locally.
  const getFrame = useCallback(() => {
    const now = performance.now();
    const frame = sampleFrame(bufferRef.current, now);
    const own = ownRef.current;
    // Setup feedback must not wait for a calibrated phone or a round trip.
    // A missing/stale camera sample hides the body rather than freezing it.
    const localBody = own.joints && now - own.bodyAtMs <= 300 ? own.joints : null;
    const showSetup = !mayStep.current;
    const wizard = wizardRef.current;
    const setupAim = {
      hand: wizard.hand ?? "right",
      direction: own.top && wizard.forward && now - own.topAtMs <= PHONE_FRESH_MS
        ? phoneInBody(own.top, wizard.forward, wizard.mirrorAim) : [0, 1, 0] as Vec3,
    };
    if (!frame) return showSetup
      ? withSetupBody(null, slotRef.current, localBody, boardRef.current.cellSize, now, setupAim)
      : null;
    const fresh =
      own.joints &&
      own.top &&
      now - own.topAtMs <= PHONE_FRESH_MS &&
      wizard.forward;
    // Where your own step glide has you: frames only overrule it when they keep disagreeing.
    const { cellSize, stepMs } = boardRef.current;
    const myCell = frame.players.find((p) => p.slot === slotRef.current)?.cell;
    if (myCell)
      ownGlideRef.current = reconcile(
        ownGlideRef.current,
        myCell,
        cellSize,
        now,
      );
    const root = ownGlideRef.current
      ? glideRoot(ownGlideRef.current, cellSize, stepMs, now)
      : undefined;
    const drawn = withLocalFighter(
      frame,
      slotRef.current,
      fresh
        ? {
            joints: own.joints!,
            top: own.top!,
            forward: wizard.forward!,
            mirror: wizard.mirrorAim,
            hand: wizard.hand ?? "right",
          }
        : null,
      root,
    );
    return showSetup ? withSetupBody(drawn, slotRef.current, localBody, cellSize, now, setupAim) : drawn;
  }, []);

  function redoSetup() {
    const calibration = calibrationOf(wizardRef.current);
    if (calibration) void client.calibrateSaber({ ...calibration, done: false });
    const fresh = createWizard(performance.now());
    wizardRef.current = fresh;
    paintedWizardRef.current = fresh;
    sentCalibrationRef.current = "";
    setWizard(fresh);
  }

  const youArmed = you.saber.bodyReady && you.saber.saberReady;
  const rivalArmed = rival.saber.bodyReady && rival.saber.saberReady;
  const fighting = view.phase === "active" && wizard.step === "done" && youArmed && rivalArmed && Boolean(saberStart?.unlocked) && serverFresh;
  mayStep.current = fighting;
  const finished = view.phase === "finished";
  // Commands stay on the strict gate above; what's drawn holds through a short tracking
  // gap so a 300 ms input stall on either side doesn't flash the initiation screen.
  const [hold, setHold] = useState<FightHold>(IDLE_HOLD);
  const unlocked = Boolean(saberStart?.unlocked);
  const active = view.phase === "active";
  useEffect(() => {
    setHold((h) => tickFightHold(h, { fighting, unlocked, active, nowMs: performance.now() }));
  }, [fighting, unlocked, active]);
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    if (hold.lostAtMs === null) { setGraceOver(false); return; }
    const left = TRACKING_GRACE_MS - (performance.now() - hold.lostAtMs);
    const id = window.setTimeout(() => setGraceOver(true), Math.max(0, left));
    return () => window.clearTimeout(id);
  }, [hold.lostAtMs]);
  const inFight = fighting || (!graceOver && holdsFight(hold, false, performance.now()));
  useLyraArenaSpeak(client, {
    step: wizard.step,
    fighting: inFight,
    finished,
    winner: view.result?.winner,
    mySlot: you.slot,
  });
  // Rematches reuse this component, but must wait for the new round's server gate.
  useEffect(() => { if (finished) setSaberStart(null); }, [finished]);
  useEffect(() => {
    if (finished && view.result?.reason === "knockout") gameAudio.play("saberKo");
  }, [finished, view.result?.reason, view.matchId, view.round]);
  useEffect(() => {
    if (inFight && running && !loading && replayEnabled && videoRef.current && onReplaySource) return onReplaySource(videoRef.current);
  }, [inFight, running, loading, replayEnabled, onReplaySource]);

  return (
    <main className="arena-duel" data-initiating={!inFight && !finished} data-finished={finished || undefined}>
      <div className={`si-arena-viewport${finished ? " si-arena-viewport--finished" : ""}`} aria-hidden={finished || undefined}>
      <ArenaRenderBoundary key={renderAttempt} onLeave={onLeave} onBasic={() => { setBasicGraphics(true); setRenderAttempt((n) => n + 1); }}>
      <ArenaScene
        destination={destinationFromWorld(view.world.id)}
        basicGraphics={basicGraphics}
        initiation={!inFight && !finished}
        getFrame={getFrame}
        flashRef={flashRef}
        mySlot={you.slot}
        board={view.board}
      />
      </ArenaRenderBoundary>
      </div>

      <div className="arena-hud">
        <button type="button" className="arena-leave" onClick={finished ? onLeave : onForfeit}>
          {finished ? "Back to bridge" : "Forfeit"}
        </button>
        {inFight && replayEnabled && onReplayEnabled && <button type="button" className="arena-replay-stop" onClick={() => onReplayEnabled(false)}>Stop replay recording</button>}
        {inFight && !fighting && <p className="arena-note arena-tracking" role="status">
          {trackingLossNote({ youBody: you.saber.bodyReady, youSaber: you.saber.saberReady, rivalArmed, serverFresh, rivalName: rival.callsign })}
        </p>}
        {!inFight && !finished && <p className="arena-note" role="status">
          {view.phase === "waiting"
              ? `Waiting for ${rival.callsign} to arrive in the arena…`
              : wizard.step === "done"
                ? `Waiting for ${rival.callsign} to finish setup…`
                : "Finish setup to fight."}
        </p>}
      </div>

      {!inFight && view.phase !== "finished" && <SaberInitiation
        step={wizard.step} progress={wizard.progress} running={running} loading={loading}
        bodySeen={bodySeen} phonePaired={you.saber.paired} phoneLive={you.saber.phoneLive}
        youReady={youArmed} rivalReady={rivalArmed} yourName={you.callsign} rivalName={rival.callsign}
        start={saberStart} serverFresh={serverFresh} qr={qr} saberUrl={saberUrl}
        replayEnabled={replayEnabled} onReplayEnabled={onReplayEnabled}
        notes={wizard.notes} error={error} onStart={() => setRunning(true)} onRedo={redoSetup}
      />}
      <SaberCountdown start={saberStart} remaining={countdown} fresh={!finished && serverFresh && wizard.step === "done" && youArmed && rivalArmed} />
      {running && !inFight && !finished && <span className="si-self-label">LIVE CAMERA</span>}

      {(inFight || finished) && (
        <BattleHud client={client} view={view} fighting={inFight} finished={finished}>
          <div className="bh-result-actions">
            <p className="arena-result-status" role="status">
              {!rival.connected
                ? `${rival.callsign} returned to the cockpit.`
                : you.rematch
                  ? `Waiting for ${rival.callsign} to accept the rematch…`
                  : rival.rematch
                    ? `${rival.callsign} wants a rematch!`
                    : "Rematch keeps your camera and saber setup."}
            </p>
            {note ? <p className="arena-warning">{note}</p> : null}
            <div className="arena-setup-actions">
              <button type="button" disabled={you.rematch || !rival.connected} onClick={onRematch}>
                {you.rematch ? "Rematch requested" : rival.rematch ? "Accept rematch" : "Rematch"}
              </button>{" "}
              <button type="button" className="secondary" onClick={onLeave}>
                Back to bridge
              </button>
            </div>
            {resultExtra}
          </div>
        </BattleHud>
      )}
      {engaged && fighting ? (
        <div className="arena-engaged">ENGAGED</div>
      ) : null}
      {toast ? (
        <div className="arena-toast" role="status">
          {toast}
        </div>
      ) : null}
      {fighting ? (
        <p className="arena-controls">
          Swipe on your phone with your thumb to move: ↑ in · ↓ out · ← →
          circle · or WASD
        </p>
      ) : null}
      <video
        ref={videoRef}
        className={`arena-self ${running && !finished ? "" : "hidden"}`}
        playsInline
        muted
        autoPlay
      />
    </main>
  );
}

function midpoint(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}
