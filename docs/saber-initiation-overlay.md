# Live Mars saber initiation

## Goal, ownership, and exclusions

Replace the long setup checklist with one task at a time, using the cinematic initiation design over the existing live Mars arena. Keep the avatar visible to the right and the mirrored self-camera in its existing bottom-right corner. Every slide follows measured setup progress, then both pilots share a server-controlled 3–2–1 before swings count.

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

Mars and both live avatars continue rendering beneath the translucent instruction layer. During setup, the same renderer uses a wider camera framing with the fighters shifted to the right; combat returns smoothly to the existing shoulder camera. No duplicate WebGL scene, remote CV, or video upload.

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
