import { isFinishingHit } from "../vfx/observations";
import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import QRCode from "qrcode";
import type {
  ArenaFrame,
  PlayerView,
  SaberAim,
  SetupStep,
  StepDirection,
  Vec3,
} from "../../../server/src/contracts";
import type { GameClient } from "../networking";
import { saberControllerUrl } from "../networking/gameEndpoint";
import { WASM_ROOT } from "../camera/mediapipeVision";
import { placement, worldToBody } from "./bodyFrame";
import { createArenaBuffer, pushFrame, sampleFrame } from "./arenaBuffer";
import { createStabilizer, stabilize } from "./bodyStabilizer";
import { withLocalFighter } from "./localFighter";
import { glideRoot, onOwnStep, reconcile, type OwnGlide } from "./ownGlide";
import { ArenaScene, type ImpactFlash } from "./ArenaScene";
import {
  applyCameraFix,
  calibrationOf,
  createWizard,
  INSTRUCTIONS,
  mirrorIndex,
  STEP_ORDER,
  tickWizard,
  type WizardState,
} from "./setupWizard";
import "./arena3d.css";

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
const BLOCKED_TOAST_MS = 900;

// Setup steps shown as a checklist (the final "done" isn't a step to do).
const CHECKLIST: SetupStep[] = STEP_ORDER.filter((step) => step !== "done");

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
}: {
  client: GameClient;
  view: PlayerView;
  pairCode: string;
  note: string;
  /** Back to the cockpit; before the end this forfeits. */
  onLeave: () => void;
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
    top: Vec3 | null;
    topAtMs: number;
  }>({ joints: null, top: null, topAtMs: 0 });
  const slotRef = useRef(view.you.slot);
  slotRef.current = view.you.slot;
  const flashRef = useRef<ImpactFlash | null>(null);
  const wizardRef = useRef<WizardState>(createWizard(performance.now()));
  const phoneRef = useRef<{ aim: SaberAim; atMs: number } | null>(null);
  const sentCalibrationRef = useRef("");
  const [wizard, setWizard] = useState<WizardState>(wizardRef.current);
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

  // Flicks and keys both go through the server's validated step command.
  const step = useCallback(
    (direction: StepDirection) => {
      void client.step(direction).then((reply) => {
        if (reply.status !== "rejected" || reply.reason !== "blocked") return;
        setToast(
          direction === "forward" ? "Your rival is there" : "Edge of the arena",
        );
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(
          () => setToast(null),
          BLOCKED_TOAST_MS,
        );
      });
    },
    [client],
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
      const players = frameRef.current?.players ?? [];
      const attacker = players.find((p) => p.slot === event.attackerSlot);
      const defender = players.find((p) => p.slot !== event.attackerSlot);
      let at: Vec3 | null = null;
      if (event.outcome === "blocked" && attacker?.blade && defender?.blade) {
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
          damage: event.damage,
          isKill: isFinishingHit(event, client.view()),
          targetSlot: defender?.slot,
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
  }, [client]);

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
        setBodySeen(Boolean(world));

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
          ownRef.current = { ...ownRef.current, joints: body };
        } else {
          ownRef.current = { ...ownRef.current, joints: null };
          stabilizer = createStabilizer();
        }

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
          wizard.step !== before.step ||
          Math.abs(wizard.progress - before.progress) > 0.05
        )
          setWizard(wizard);

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
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [running, client]);

  // What the scene draws each frame: server frames played back smoothly, with your own fighter drawn locally.
  const getFrame = useCallback(() => {
    const now = performance.now();
    const frame = sampleFrame(bufferRef.current, now);
    if (!frame) return null;
    const own = ownRef.current;
    const wizard = wizardRef.current;
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
    return withLocalFighter(
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
  }, []);

  function redoSetup() {
    const fresh = createWizard(performance.now());
    wizardRef.current = fresh;
    sentCalibrationRef.current = "";
    setWizard(fresh);
  }

  const youArmed = you.saber.bodyReady && you.saber.saberReady;
  const rivalArmed = rival.saber.bodyReady && rival.saber.saberReady;
  const fighting = view.phase === "active" && youArmed && rivalArmed;
  const currentIndex = CHECKLIST.indexOf(wizard.step);

  return (
    <main className="arena-duel">
      <ArenaRenderBoundary key={renderAttempt} onLeave={onLeave} onBasic={() => { setBasicGraphics(true); setRenderAttempt((n) => n + 1); }}>
      <ArenaScene
        basicGraphics={basicGraphics}
        getFrame={getFrame}
        flashRef={flashRef}
        mySlot={you.slot}
        board={view.board}
      />
      </ArenaRenderBoundary>

      <div className="arena-hud">
        <div className="arena-bars">
          <Bar label="You" value={you.health} side="you" />
          <Bar label={rival.callsign} value={rival.health} side="rival" />
        </div>
        <button type="button" className="arena-leave" onClick={onLeave}>
          Forfeit & return
        </button>
        <p className="arena-note" role="status">
          {fighting
            ? note
            : view.phase === "waiting"
              ? `Waiting for ${rival.callsign} to finish the briefing…`
              : wizard.step === "done"
                ? `Waiting for ${rival.callsign} to finish setup…`
                : "Finish setup to fight."}
        </p>
      </div>

      {!fighting && view.phase !== "finished" ? (
        <section className="arena-setup" aria-label="Setup">
          <h2>Link your saber</h2>
          <div className="arena-checks">
            <Check
              ok={running && bodySeen}
              label={
                running
                  ? bodySeen
                    ? "Camera sees you"
                    : "Camera can't see you"
                  : "Camera off"
              }
            />
            <Check
              ok={you.saber.paired}
              label={you.saber.paired ? "Phone linked" : "Phone not linked"}
            />
            <Check
              ok={you.saber.phoneLive}
              label={
                you.saber.phoneLive
                  ? "Phone motion live"
                  : you.saber.paired
                    ? "Tap Ignite saber on the phone"
                    : "No phone motion"
              }
            />
          </div>

          {!running ? (
            <div className="arena-setup-actions">
              <button type="button" onClick={() => setRunning(true)}>
                Start camera
              </button>
            </div>
          ) : loading ? (
            <p className="arena-instruction">Loading body tracking…</p>
          ) : (
            <>
              <ol className="arena-steps">
                {CHECKLIST.map((step, i) => (
                  <li
                    key={step}
                    className={
                      i < currentIndex || wizard.step === "done"
                        ? "done"
                        : i === currentIndex
                          ? "now"
                          : ""
                    }
                  >
                    {INSTRUCTIONS[step]}
                    {i === currentIndex ? (
                      <div className="arena-progress">
                        <div
                          style={{
                            width: `${Math.round(wizard.progress * 100)}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
              {(wizard.step === "phone" || !you.saber.paired) && pairCode ? (
                <div className="arena-pair">
                  {qr ? (
                    <img
                      src={qr}
                      alt={`QR code for ${saberUrl}`}
                      width={150}
                      height={150}
                    />
                  ) : null}
                  <p>
                    Scan with your iPhone camera, or open{" "}
                    <strong>{saberUrl}</strong>
                  </p>
                </div>
              ) : null}
              {wizard.notes.map((n) => (
                <p key={n} className="arena-warning">
                  {n}
                </p>
              ))}
              <div className="arena-setup-actions">
                <button type="button" className="secondary" onClick={redoSetup}>
                  Redo setup
                </button>
              </div>
            </>
          )}
          {error ? <p className="arena-error">{error}</p> : null}
        </section>
      ) : null}

      {engaged && wizard.step === "done" ? (
        <div className="arena-engaged">ENGAGED</div>
      ) : null}
      {toast ? (
        <div className="arena-toast" role="status">
          {toast}
        </div>
      ) : null}
      {wizard.step === "done" ? (
        <p className="arena-controls">
          Swipe on your phone with your thumb to move: ↑ in · ↓ out · ← →
          circle · or WASD
        </p>
      ) : null}
      <video
        ref={videoRef}
        className={`arena-self ${running ? "" : "hidden"}`}
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

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`arena-check ${ok ? "ok" : ""}`}>
      {ok ? "✓" : "•"} {label}
    </span>
  );
}

function Bar({
  label,
  value,
  side,
}: {
  label: string;
  value: number;
  side: "you" | "rival";
}) {
  return (
    <div className="arena-bar">
      <span>{label}</span>
      <div className="arena-bar-track">
        <div
          className={`arena-bar-fill ${side}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <strong>{value}</strong>
    </div>
  );
}
