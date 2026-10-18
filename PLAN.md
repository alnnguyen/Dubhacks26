# TEAM ALIGNMENT — Spaceship Lobby → Camera Duel

Current proposed build plan • Saturday, October 17, 2026, about 3:00 p.m. Pacific. Submission deadline: Sunday, October 18, 10:00 a.m. Pacific; team target: 9:00 a.m. Assign names to A–D at kickoff. This is the version to review together before implementation; it supersedes earlier native-app, campus-conquest and virtual-avatar-arena plans for the proposed submission. Older tabs remain historical references.

## The game we are building

You are a pilot inside a spaceship. Through the cockpit windshield you see other available players’ ships. Select a friend’s ship and challenge them. They receive a ship alert and a Photon message. After both accept, a shared wheel chooses real-world gravity conditions. A short launch transition opens a camera duel: you see your real friend, your hand wields virtual energy effects, and a gesture lifts and throws a rock with a gravity-dependent defense window.

The spaceship lobby is part of the MVP, not something to remove. Its first implementation is one attractive cockpit with selectable ship markers and readable panels. The fight is the core interaction; the lobby, challenge, wheel, narration and results make it a complete world.

Pitch: “Choose a rival ship, jump into a camera duel, and wield a rock attack shaped by real planetary gravity.”

## One complete player journey

1. Join the session. Open the HTTPS website, choose a callsign and connect to a shared demo room. Link a Photon channel identity for real messages. A room link/code is sufficient; no GPS or global matchmaking is needed.

2. Enter your cockpit. See your own pilot identity, weapon color and other connected pilots represented as ships outside the windshield. Ships are selectable UI objects, not location-tracked physical spacecraft.

3. Pick another ship. Tap the ship to open its pilot card and press Challenge. Labeling may say “Attack / Challenge,” but it sends an invitation; it does not start damage or force a player into combat.

4. Defender responds. Their cockpit flashes an incoming challenge and the ship AI sends a real Photon message containing the challenge ID. Accept or decline from the app or messaging channel. Both players see consistent pending/accepted status.

5. Shared arena wheel. The server selects one condition—Earth, Mars or Moon—and both screens animate toward that same selection. Display source gravity, a short explanation and a Ready button. Moon is a satellite, so call it an Arena/World Wheel rather than calling all entries planets.

6. Jump and calibrate. A short hyperspace effect transitions to the back camera. Stand in a clear, well-lit area facing the other player. Calibration confirms your own hand and the opponent can be detected together; show actionable framing guidance.

7. Fight. Each phone shows the real opponent with a tracked health bar, a small recognition indicator, virtual weapon/rock effects and touch alternatives. Both devices share one match clock, health and result. No video stream between phones is necessary.

8. Return to ship. Show winner/draw, final health, result message and Rematch / Back to cockpit. A simple win count is optional; no planet ownership, conquest economy or troop progression is needed.

## Platform and what “AR” means here

Build a browser game using React/TypeScript, Three.js overlays, browser camera capture and MediaPipe. Target two identified phones over HTTPS first. Do not start a parallel Swift/Xcode implementation. A laptop version is a fallback platform if actual phone tests fail, not a second product to build concurrently.

This is screen-space camera combat: detect a person in the image and recognize your nearer hand as input. It is not a shared metric 3D room map. In the current saber duel the players aren't in the same room's geometry at all: each body is tracked by its own laptop and placed in a virtual arena, so blade collisions are virtual, not physical contact.

One rear-camera stream must show your own free hand near the camera and the opponent farther away. Test actual framing instead of promising a universal distance or lens. Start with the default rear lens; ultra-wide selection is an optional device-specific enhancement. Hold or prop the phone, keep your hand low/to the side and avoid obscuring the opponent.

Use local Hand Landmarker for gesture commands and Pose Landmarker for the opponent overlay. Interleave inference, smooth the anchor and keep the overlay light. Proposed frame rates are performance targets, not validated facts. If own-hand selection is ambiguous, pause gesture actions and recalibrate; do not lower thresholds until false positives cause attacks.

Camera calibration on both actual phones is the highest-risk feasibility gate. Opponent hands can be confused with the player’s hand. Use a calibrated hand region/size and temporal tracking, inspect mistakes and keep explicit recovery. No heuristic guarantees that this never happens.

## Combat: laptop + iPhone lightsaber duel in a shared 3D arena (current — decided 2026-10-17 ~22:50 after two phone-camera versions failed on devices)

Each player has their own laptop and iPhone. The laptop camera tracks that player's body with MediaPipe Pose 3D world landmarks; the paired iPhone is the saber: its orientation gives the blade direction (out of the phone's top edge), recentered by pointing at the laptop screen. The hilt is the saber-hand wrist from the laptop camera. Only the head, shoulders, hips, elbows and wrists are tracked, smoothed with a One Euro filter on the laptop; the lower body is a fixed standing pose under the hips (out-of-frame legs were most of the avatar's shake), and hips that leave the frame sit below the shoulders at the last measured torso length. Movement now uses opponent-relative orbits (user decision, October 18): left/right swipes move along circular arcs around the rival without an angular boundary, while forward/back change separation by 0.65 m within a 1.3–3.9 m gap. Both fighters continually face each other, so the shoulder camera follows the changing duel direction. Each swipe glides for 110 ms and one additional swipe can be buffered. The server accepts movement through the existing step command and announces its destination plus an optional world-space orbit center to both laptops. The q/r wire coordinates are now fractional arena coordinates, not owned grid cells. Round foot markers replace the lane board. Engagement depends on current hip separation (at most approximately 1.45 m), and exact blade/body collision checks still determine hits and blocks. When both players move, each accepted orbit uses the rival's latest accepted destination; subsequent swipes follow the moving rival. Laptops play the server's 30 Hz frames back smoothly by blending between them, and draw their own fighter from local camera and phone data (display only), with a swing trail on the blades.

The server places both bodies in one virtual arena (meters; slot 2 1.3 m away, turned around) and runs a 30 Hz tick: a fast blade-tip movement is a swing; the sweep is checked in 10 sub-steps, and touching the defender's blade blocks while touching their torso capsule or head hits — the blade wins at the same sub-step. One outcome per swing, swing cooldown, clash recoil. Inputs older than 300 ms (camera or phone tracking lost) drop the blade and cancel the swing. Swings only count once both players have finished setup: body calibrated, phone paired and recentered. Clients send only their own body and aim; the server decides every hit. Body joints are self-reported, so this is trust-based, not cheat-proof.

Laptops render the arena on the Mars terrain from over the player's own shoulder, with both fighters as glowing avatars from their streamed skeletons. Phones play the saber hum (pitch with swing speed), clash and hit sounds; iOS browsers have no vibration API. Pairing: the laptop shows a QR code of the pilot's private 6-character code link; a phone opening /?saber=CODE becomes that pilot's saber, and a newer phone replaces the old one. Codes don't expire in this demo. A guided setup, shown on both the laptop and the phone, then links the devices: stand still, ignite the phone, point it level at the screen (heading), raise it (the camera picks the saber hand), point right and thrust forward (these detect and correct a phone or camera that reads left/right or depth backwards). The phone only streams raw orientation; the server applies the measured calibration. `/?dev=arena` shows the scene with synthetic fighters.

Constants are placeholders in `server/src/game/rules.ts` (`SABER`). Gravity currently does not change saber combat. Space-data features are deferred until the duel works on devices.

## Combat: rock duel (superseded by the lightsaber duel; code removed October 18, kept here as history)

Initial rules: 60-second round, 100 health each, server-defined damage/cooldowns, win at zero opponent health or higher remaining health at the end; equal health is a draw. These are proposed design settings to tune, not scientific measurements.

First working combat: open palm held briefly lifts a virtual rock; an explicit fist releases it; tracking loss cancels or times out rather than firing. Opponent receives an incoming warning and can press Block in the allowed window. The rock can float above the tracked hand and animate toward the opponent’s screen anchor.

Use a small state machine: IDLE → CHARGING → HELD → LAUNCHED → COOLDOWN. Starting design targets: roughly 500 ms deliberate palm hold, a maximum held duration and a several-second cooldown. B and C agree on exact constants once and share them. Touch Special/Block use exactly the same rules as camera inputs.

Then add the gun: one visible attack with cooldown and readable effects. After the complete loop is stable, add one-finger sword / two-finger gun selection with a short confirmation hold and a scripted sword slash. Do not make three gesture weapons a prerequisite for the first playable duel.

Sword swipes and screen-box intersections are game approximations, not proof of real contact. Avoid physical range claims from an uncalibrated body box. Start with explicit attack actions and simple block rules; aim-ray and gesture-slash sophistication are optional increments.

The server owns health, cooldowns, attack sequence, incoming/block timing, round start/end and winner. Camera confidence/target-in-frame information is client-reported; server validation can enforce rules but cannot prove the camera claim without additional verification. Describe the prototype as trust-based camera targeting, not cheat-proof.

## Real dataset: gravity changes the battle

Use NASA’s Planetary Fact Sheet as a small curated dataset. Its rounded values are Earth 9.8 m/s², Mars 3.7 m/s² and Moon 1.6 m/s². Check in a versioned data file with source URL, units and retrieval date; both clients use the server-selected record. No runtime scientific API is needed for each round.

For this camera-overlay version, use an explicitly labeled gameplay mapping from gravity to rock flight time and defense opportunity. Proposed mapping: flightSeconds = 0.8 × sqrt(9.8 / sourceGravity), giving approximately 0.8 s Earth, 1.3 s Mars and 2.0 s Moon. This is a designed transformation of real data, not a universal projectile-physics law.

Animate a readable screen-space arc consistent with the chosen duration. Do not claim the animation is a physically reconstructed throw across a measured real-world distance. State the honest benefit: “Real gravity values change attack timing and the time available to defend.” Tune damage/cooldowns with those windows so Moon remains fun and fair.

Show the raw gravity and mapping in the briefing or info panel. Provide a comparison mode outside ordinary random matches showing the same attack under Earth and Moon conditions. This proves the data changes the game rather than just the background.

World tints and particles are fictional atmosphere/art direction. A Mars tint is not live Martian weather. Real terrain reconstruction, satellite tracking and extra datasets are outside the first build.

## Sponsor roles that remain meaningful

Chef’s Choice: the cockpit-to-duel experience, camera interaction, creative space presentation and multiplayer gameplay are the primary story.

SpaceXAI: substantive development in Cursor plus an actual Grok Voice or Imagine API integration, as required in the supplied brief. Choose Grok Voice for ship narration and a minimal state-aware copilot. Strong proof: ask “What world did we get?” and have a genuine voice interaction read the selected match state. If using only xAI TTS, confirm that use meets the event’s interpretation of the Voice API requirement before relying on it alone.

Official Grok Bot: use it for real project planning and collaboration, with this plan, owners, contracts, blockers and demo checks. That is the stated bonus. In-game characters using the Grok API do not automatically count as the official Grok Bot product. Autonomous troop gameplay is not needed for this plan.

Photon 2.0: ship AI sends a challenge and handles ACCEPT / DECLINE / STATUS replies tied to a challenge ID, then sends a result. This creates a small functional messaging agent rather than only three outgoing notifications. Pick one provisioned channel. In-app challenges remain usable if a message is delayed, but mocks do not establish sponsor eligibility.

Perceptron: optional Replay Coach using an actual workshop-provided Mk/Isaac model to identify events in a short recorded duel and provide grounded timestamps/observations. MediaPipe alone does not qualify. Capture rendered/sanitized gameplay evidence where possible; if real people appear, get their consent before uploading. Confirm supported media formats and actual workshop access. Cut this feature/track first if it threatens the duel.

Treat the pasted sponsor requirements as the planning basis, and check expanded event rules, judging criteria and submission selections with organizers. Document actual integrations and their limitations.

## MVP, next increments and cuts

MVP: two phones, spaceship cockpit with selectable rival ship, challenge/accept, synchronized wheel, gravity briefing, calibration, tracked opponent overlay, deliberate rock lift/release, block, consistent server result, return/rematch, real Photon replies and one actual Grok Voice integration. A simple gun is the next combat increment.

Next increments only after the full loop works: finger-based weapon selection, saber, better effects, customization and gyro look-around. Basic cockpit styling stays; elaborate cockpit modeling and motion permissions do not block gameplay.

Bump challenge is optional because ship selection already solves choosing an opponent. If added, use it within a known room with explicit confirmation. Keep the room code visible and easy to use.

Cut first: Perceptron coach, gyro, bump, extra customization, complex aiming, sword-swipe recognition and multiple weapon gestures. Do not cut multiplayer consistency, the camera feasibility test, gravity’s actual game effect or real sponsor evidence while polishing optional screens.

Outside scope: native iOS app, ARKit shared room mapping, physical cover reconstruction, campus GPS, planet ownership, offline armies, training/economy, continuous nearby tracking and full-body/saber collisions.

## Four-person responsibilities

A — spaceship/UI and release captain. Own cockpit scene, ship selection, challenge panels, wheel animation, briefing, HUD, result/rematch and responsive app composition. Help C with presentation after the lobby connects. Deploy HTTPS frontend; own submission, recording coordination and judge-access links. Acceptance: a player can complete cockpit → challenge → wheel → calibration → duel → result on a target phone.

B — multiplayer/rules/physics owner. Own session identities, challenge state machine, WebSocket server, authoritative clock/health/block/cooldowns, seeded world selection, gravity data/mapping, reconnect and results. Publish shared command/event types first. Acceptance: both phones agree on world, attacks, health and winner; duplicate inputs cannot cause duplicate damage; Photon commands use the same validated action path.

C — camera/gestures/overlay owner. Own rear-camera lifecycle, own-hand selection, opponent tracking, calibration, smoothing, gesture state machine, rock/weapon overlay and fallback controls. Acceptance: deliberate hand input on one phone produces the agreed battle event visible on both; tracking loss does not fire; health anchoring is usable during a full round. C owns the biggest technical risk; A supplies UI/effects help rather than adding more obligations.

D — sponsor integrations/copilot owner. Own Photon linking/send/receive, challenge reply interpretation, result messages, Grok Voice, actual Grok Bot planning setup, integration evidence and optional Perceptron. Acceptance: real inbound reply changes a real challenge; real Voice API interaction references match state; no remote inference runs on the combat timing path. A can help with narration button/subtitle UI.

## Shared contracts and AI coding workflow

Use one repository: web client, persistent Node/WebSocket server, shared contracts and shared rules/gravity records. React/TypeScript and Three.js are sufficient. Keep API keys server-side. Shared sessions and challenge IDs identify the actual opponent; ship positions are presentation, not GPS.

Core match states: LOBBY → CHALLENGED → ACCEPTED → WORLD_SELECTED → CALIBRATING/READY → COUNTDOWN → ACTIVE → FINISHED; include decline, expiry, cancellation and reconnect behavior. Commands include challenge, accept/decline, ready, startLift, releaseRock, cancelLift, block, optional attack/selectWeapon and rematch.

Each command has an authenticated session, unique command ID and relevant match/challenge ID. B controls contract changes. C translates camera poses to these same commands; D translates message/voice requests to them; A binds UI controls to them. No separate provider-specific combat rules.

One human owns each bounded branch/worktree. Use Cursor for substantive implementation; Codex/Claude can investigate or implement separate scoped tasks and review changes. Do not have assistants edit the same files concurrently. Every task specifies goal, owned paths, interfaces, exclusions and an acceptance check.

Merge small working increments every 60–90 minutes and test against the current deployed build. Every owner integrates their own feature; A is not responsible for rescuing four isolated modules at the end. Keep one board with owner, next action and blocker. Grok Bot can summarize actual planning; Git and contracts remain authoritative.

Repository alignment: AGENTS.md now describes this web camera-duel plan. PLAN.md is the product scope; docs/contracts.md records the interface decisions. Do not introduce a native iOS architecture or revive earlier plans without an explicit team decision.

## Timeline to Sunday 10 a.m. — all Pacific

3:00–3:30 p.m. Saturday: agree on this experience, assign names, reconcile repository instructions, freeze interfaces, select phones and set up HTTPS/server/keys. A builds cockpit shell; B connects sessions; C tests camera framing; D proves provider access.

3:30–4:30 p.m.: feasibility gate. Show own-hand and opponent detection together on both phones, with a basic overlay; exchange one game event between clients; send/receive a real Photon message; establish a real Grok Voice API call. Test phone grip/stand and selected camera. If camera fails, simplify/reframe now rather than polishing the lobby.

4:30–5:00 p.m.: choose the Perceptron go/no-go from access and one small inference proof, without delaying the duel. B and C complete touch-driven rock/block/health first. A connects ship selection to challenge acceptance. D connects real message acceptance to that same challenge.

5:00–7:00 p.m.: integrate the entire flow, including wheel, source gravity mapping, palm/fist control, block, winner and rematch. Grok explains the selected condition. At 7:00 demonstrate a full round on two actual phones. If behind, stop extras and fix the loop.

7:00–9:30 p.m.: add gun and weapon selection/saber only if the loop passes. Refine cockpit readability, anchoring, recognition feedback, audio/subtitles and gravity balance. Test reconnect, duplicate replies, expired challenges, tracking loss, denied permissions and repeated rounds. Record an early backup demo. Prepare Devpost draft by 9:30 p.m.; verify any separate team registration/draft deadline directly.

10:00 p.m.: feature freeze; save a known-good deployed build. Blocking fixes and presentation only afterward. No new multiplayer architecture, framework or gesture system.

10:00 p.m.–12:30 a.m.: final device checks and backup video. Then stagger rest: A/C rest 12:30–3:30 a.m. while B/D stabilize; B/D rest 3:30–6:30 while A/C handle visual QA/footage. Handoff notes are required and do not alter sleeping owners’ contracts. Arrange additional rest where possible.

6:30–7:30 a.m. Sunday: full-team smoke test and final recording. Show source-data effect, real camera gesture, consistent match result, Photon reply and actual Grok Voice integration. No new features.

7:30–8:30 a.m.: finalize write-up/video, exact track selections, all members, source attribution, limitations, setup instructions and externally accessible links. Check organizer-required video length and fields.

8:30–9:00 a.m.: A submits and D verifies submission/track evidence. Save confirmation. 9:00–10:00 a.m. is contingency buffer. Confirmed final deadline: 10:00 a.m. Sunday October 18.

## The demo everyone rehearses

“You’re in your spaceship. Pick my ship and challenge me.” Show the real Photon message and acceptance. Both wheels reveal Mars. The copilot explains the gravity effect. Camera opens, opponent locks in, a palm lifts the rock and a fist launches it. The other player blocks or takes damage. Show server result, return to cockpit, then briefly compare the same attack under Earth/Moon conditions. Perceptron is shown only if actually implemented.

Success means the sequence works repeatedly on the two demo devices. A measured, honest camera-combat prototype is enough; do not describe it as physically accurate room-scale sword tracking. Backups are clearly labeled recordings or touch controls, never presented as live gesture/location features.

## Sources and status

NASA gravity dataset: https://nssdc.gsfc.nasa.gov/planetary/factsheet/ • interpretation notes: https://nssdc.gsfc.nasa.gov/planetary/factsheet/planetfact_notes.html

MediaPipe hand tracking: https://developers.google.cn/edge/mediapipe/solutions/vision/hand_landmarker/web_js • camera permission: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

Grok Voice: https://docs.x.ai/developers/model-capabilities/audio/voice • official Grok Bot: https://docs.x.ai/grok-bot/team-bots

Photon 2.0: https://photon.codes/blog/introducing-photon-2.0 • Perceptron: https://www.perceptron.inc/blog/introducing-perceptron-mk1-5

This is a scoped recommendation, not evidence that the game already works. Actual phone camera performance, gesture reliability, provider access and event-specific eligibility remain gates to test. First team action: read the concept and journey together, agree on the web camera-duel version, then assign A–D before anyone asks a coding agent to implement a different architecture.
