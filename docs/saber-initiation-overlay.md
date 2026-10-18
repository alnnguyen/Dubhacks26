# Live Mars saber initiation

## Goal, ownership, and exclusions

Replace the long setup checklist with one task at a time, using the cinematic initiation design over the existing live Mars arena. Show cinematic task copy and device/progress feedback on the left, the real tracked avatar centered in a clearly framed square on the right, and the mirrored self-camera in its existing bottom-right corner. Every slide follows measured setup progress, then both pilots share a server-controlled 3–2–1 before swings count.

Owned paths: ArenaDuel, ArenaScene setup camera framing, new SaberInitiation component/CSS and development preview, arena-buffer metadata, setup-start rules/tests and optional wire fields, phone startup status, routing and handoff docs. No new dependencies, provider keys, endpoints, attacks, calibration thresholds, planets, or deployment. Concurrent sound/LYRA edits remain separate.

## Actual game flow

Normal Live challenge → accepted match → existing Mars travel/briefing → Ready → arena. Click Start camera explicitly, then the existing measured wizard advances through:

1. Position: body visible and stable.
2. Phone: pair using the real QR, Ignite saber, and provide fresh motion.
3. Forward: hold the top edge level toward the laptop.
4. Raise: find the saber hand above the head.
5. Right: check side alignment.
6. Reach: check depth alignment.

The existing calibration algorithm, holds, notes/assumption fallbacks, camera permission request, and touch/phone controls remain. Each step shows real hold progress and independent camera/paired-phone/motion indicators. A short success message accompanies measured advancement. The frontend progress update compares against the last painted value, fixing a bar that could remain frozen when individual frame increments were less than 5%.

Task headings use the approved cinematic blue plates and laser transitions. During setup the existing canvas renders your real tracked avatar in a navy grid square; its camera centers your full figure and blade. At authoritative GO the same canvas expands to the full Mars scene with both avatars and the existing shoulder camera. No duplicate WebGL scene, remote CV, or video upload.

Setup complete shows both pilots' readiness. When both are connected and have fresh calibrated body/phone input, the server sets one three-second deadline. Damage from setup swings cannot occur during that period. Tracking loss before GO cancels the deadline and a fresh three seconds starts when both recover. After the first GO, later tracking loss pauses swings through existing freshness rules; it does not repeat the countdown. Restart setup explicitly invalidates the previous calibration until measurements complete again.

The laptop estimates countdown seconds using server frame time plus elapsed local monotonic time. Expiry displays SYNCING until the server explicitly unlocks; the client never enables combat from a local timer. Stale arena frames suppress countdown/start readiness. Phone status updates once per countdown second and says Armed only after the shared gate opens and both pilots are ready.

## Interface / host requirement

- Optional ArenaFrame.saberStart: { startsAtMs: number | null; unlocked: boolean }. Preserved through arena interpolation.
- Optional SaberStatus.match.startsInMs; match.armed now reflects shared combat readiness, not only this phone's own setup.
- No MatchPhase or command shape changes. MatchPhase.active still begins after both briefing Ready commands; the separate saber gate protects actual startup swings. Existing rock/gun rules are retained outside the saber countdown; new attack and step commands are refused during that countdown.
- Existing recordings and legacy clients can ignore optional fields. This new laptop setup requires a host running the updated server; otherwise it shows an explicit host-update message after setup rather than inventing a successful countdown.

The host (Justin if using his public link) must run the updated frontend and backend. Pulling only frontend code cannot add the authoritative countdown to an older running server. No public deployment or endpoint edit was performed here.

## Review and tests

Visual review route: /?dev=initiation . It reuses the production overlay and Mars renderer with labelled synthetic telemetry, avatar poses, and a camera placeholder. The controls simulate step completion, device loss and the other pilot becoming ready. It creates no sockets and requests no camera/microphone permissions. The QR is explicitly design-only. Its local timer demonstrates the presentation only; it is not the production authorization path.

Server suite: 95 passed, including new no-damage-before-GO, shared deadline, tracking-loss cancellation, and normal post-GO hit checks. Existing collision fixtures now stream through the genuine countdown before testing combat; malformed-input coverage uses newer invalid input after old valid data expires. Frontend targeted suite: 32 passed covering the wizard, countdown display, arena buffer, local fighter, glide, and swipe controls. Production typecheck/build passed with the existing exploration chunk-size warning.

Browser: transparent overlay and right-hand avatar framing visually checked on Mars; readiness screen, countdown-to-combat, and tracking-loss recovery reviewed through the labelled preview. No console warnings/errors observed. Physical laptop camera + iPhone calibration, two actual players' timing, denied permissions, phone-sized layout, and sustained device FPS still need device QA. Alex said they will test the live setup; no physical-device success is claimed yet.

## Acceptance checklist for the team

- Both clients and the host run this revision, with the existing shared HTTPS frontend/phone pairing address configured correctly.
- During each real setup pose, watch your own avatar and camera, see hold progress, and advance only after the measured check.
- Confirm the real phone QR pairs with the same game server; no preview QR used.
- Finish one pilot first and verify they wait for the other. Complete both, see matching 3–2–1, and confirm swings are inactive until GO.
- Interrupt body or phone tracking during startup: readiness drops and the countdown restarts after recovery.
- Complete a fight and verify the normal result → cockpit flow and orbital/swipe controls still work.


## Approved avatar-square revision

The latest design supersedes the top-centered heading refinement: cinematic task copy and feedback are left, a real avatar is centered in a square on the right, and the existing mirrored camera stays bottom-right. ArenaDuel keeps one canvas mounted; setup uses a navy grid stage and camera centered on the local fighter. Only the local avatar/blade renders during initiation; full Mars and the rival return for combat. The displayed skeleton remains driven by live arena/body/phone input, never the illustrated preview puppet.

The title plate and laser sweep animate on task changes; reduced motion disables them. QR pairing, measured task advancement, live hold bar, recovery and server countdown are unchanged. Four-arrow quick-swipe help is instructional: one swipe gives one move, lift to re-arm; ↑ closes in, ↓ backs away, ←/→ circle. It appears while waiting for the rival or via Movement controls. There is no joystick, simulated movement command, new contract or extra readiness gate in the live game.

Review the exact production component with labelled synthetic telemetry at `/?dev=initiation`. It intentionally does not request camera/phone access or connect to a server. To physically verify: start a normal live match with the updated frontend/backend, start both cameras, pair both saber phones, perform each measured pose, confirm the actual avatar stays inside the square, then verify shared 3–2–1 changes to full Mars combat. Confirm tracking loss and Restart setup still recover. Physical validation requires those devices.

Latest validation: production build/typecheck passed; 32 focused calibration/countdown/frame/local-fighter/glide/swipe tests passed. Browser review of the labelled synthetic route confirmed pairing, measured-feedback presentation, square canvas/frame alignment, movement-help open/close, waiting readiness, countdown to full Mars, and phone tracking loss recovery, without console warnings/errors. Physical two-device validation remains pending.


## Top progress and LYRA cues

The six measured calibration checks now appear as slim rectangular segments across the top, using actual hold progress for the current segment and filled previous checks. Movement help and narration never advance or gate setup. LYRA now leads each task with a written cue from `INITIATION_CUES`, her portrait, and a brief visual halo/waveform animation. Replay repeats the animation. This release has no spoken audio or voice API calls; it works without a provider key or credits. A future server-side speech adapter can use the same cue text and drive the visual activity from actual audio playback.

Top-progress/LYRA validation: production build/typecheck passed; 32 focused tests passed; browser checked matching per-task cue/segment updates and progress visibility in movement help, with no console errors. Device QA remains pending.


## Simplified reference layout

Latest revision removes the sensor cards, duplicate hold percentage and next-step labels. Short LYRA cues match the preview; movement uses “Quick swipes. One move at a time.” Secondary controls and notes are under Setup options. Pairing QR is prominent inside the right square, covering the avatar for pairing, with its real phone-controller link preserved. Movement help likewise replaces the avatar inside that square, then the tracked avatar returns for calibration. Top measured progress, readiness/error handling and authoritative countdown remain. Build/typecheck and 32 focused tests passed; labelled preview visually checked pairing and movement without console warnings/errors. Physical device QA still pending.


## Direct arena arrival

The obsolete Flight Systems briefing page and Voice iframe are removed from FlightApp. Completing (or skipping) the accepted-match travel animation now renders ArenaDuel immediately. FlightApp sends the existing ready command once per arrived match/client; rejected entry has an explicit Retry arena entry action. It does not automatically request camera/microphone access. Calibration and authoritative combat countdown still apply. Duel rendering also avoids the old flight-flow wrapper so its broad button/text styles do not override initiation styling. Production build/typecheck and 58 focused client/cinematic/setup/countdown/swipe tests passed. Full physical two-player arrival testing remains pending.


## Immediate local setup avatar

Setup now renders fresh stabilized local camera joints before a calibrated saber or echoed arena frame exists. It uses a display-only fallback frame when needed, maps the body to the current slot/facing, and preserves available server metadata and blade. Missing/stale local tracking hides the model; timestamps are recorded after inference completes so a slow inference call does not instantly expire its new sample. This path is used only outside combat. Calibration/readiness/damage and normal combat local prediction are unchanged. Pairing and movement panels still deliberately cover the model. Build/typecheck and 31 focused tests passed, including four early-visibility/tracking-loss regressions; physical device QA pending.


## Travel reset hardening and immediate setup saber

Accepted travel is latched by opponent identity until arrival instead of being cancelled/restarted by every lobby-state update. A per-tab journey record restores launched travel or entered setup after a frontend remount/reload, only when match ID and both authoritative pilot IDs match. Explicit Stand down/Leave clears restoration. Finished matches now show their actual result even if they ended before arrival; the frontend no longer auto-leaves them unseen and silently returns to the cockpit. The precise intermittent device failure is not yet reproduced, so full travel testing remains pending.

A fresh tracked body now includes an upright wrist-anchored setup saber immediately. Once a calibrated heading and fresh phone direction are available the preview uses that aim; an available real blade is retained. This display-only fallback never sets readiness, emits an attack, or changes server damage; the frame labels it SABER PREVIEW until setup completes. Pairing/swipe overlays still cover the avatar by design. Build/typecheck and 72 focused tests passed.


## saber-duel merged into alex-dev — October 18

Source: origin/saber-duel at 7e8d387. Preserves the current cockpit/exploration, direct travel-to-setup flow, persisted journey, early camera avatar/display-only saber, compact LYRA slides, prominent QR and in-square swipe help. Integrates stamina, guard breaks/stun, rematch/forfeit, saved callsign, and the bundled travel-video fix. Removed legacy rock/gun commands and unused old camera-duel routes per Justin's lightsaber-only branch.

Calibration now uses five measured tasks: phone → stand → upright → right → reach, then done. Both phone and laptop follow that same order. One authoritative startup gate drives ArenaFrame.saberStart and view/phone startsInMs; pre-GO tracking loss cancels and restarts three seconds, local timer expiry cannot enable combat. Rematch resets the gate while keeping camera and measured calibration mounted. The phone clears a cancelled countdown and waits for actual server readiness before FIGHT.

Validation: 98/98 server tests passed (including sockets, rematch, stale-input countdown cancellation and recovery); 149 frontend tests passed, one opt-in live test skipped; frontend typecheck/production build passed. Existing large exploration chunk warning remains. Physical two-player camera/phone/travel and rematch QA remains necessary. No new dependencies, environment variables, provider calls, deployment or push. Uncommitted audio/LYRA work in the main checkout is preserved separately.
