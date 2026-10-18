# Saber setup: guided calibration UI

Proposal only. Game code, calibration thresholds, shared-server routing and combat rules are unchanged. Based on the supplied screenshot and the current `ArenaDuel`, `setupWizard` and `SaberPhone` source on alex-dev, October 18.

## Recommendation

Turn the nine-item checklist into a short guided calibration sequence. Keep all nine measurements and their current order. Present them as four chapters: Camera → Phone → Saber → Movement. Show one action at a time, with a large visual, a short instruction and clear detection feedback. The existing wizard remains the source of truth; visual polish must not change when a measurement passes.

The current screen mixes three jobs: explaining the whole process, showing the current task, and diagnosing devices. Its tall checklist buries the QR code, pending device states look like errors, and the long URL dominates the pairing area. This is the pre-battle calibration screen, separate from callsign/ship onboarding.

## Visual direction

Match the cockpit: translucent navy surfaces, crisp white headings, restrained cyan accents and small angled corners. Reuse the existing display and mono fonts. Keep instruction text readable at a distance; save the all-caps treatment for short headings. Use a compact active-action highlight rather than illuminating every element. The pairing QR keeps its plain high-contrast quiet zone. Small 150–250 ms step transitions are enough, with reduced-motion support; no extra cinematic between calibration checks.

## Proposed laptop layout

- A stable compact setup panel, roughly 380–440 px wide on a laptop, with a height bounded by the viewport. Keep the arena visible under a dark scrim rather than competing with the instructions.
- Four small chapter indicators across the top. Show the active chapter and its local check number, such as “Saber alignment · 2 of 4.” Completed chapters collapse to a checkmark.
- One headline, one instruction and one diagram in the main area. Use simple SVG figures and phone outlines; no new 3D rig, generated video or model downloads.
- Keep the mirrored camera view visible beside the guide. Add an upper-body framing outline and readable tracking feedback; do not mirror the instructional figure ambiguously.
- A small device status strip: “Camera ready · Phone waiting · Motion waiting.” Pending states are neutral. Errors are reserved for actual failure or a disconnected device.
- During a pose hold, show “Hold steady” and the real `wizard.progress` meter. On detection, a short checkmark transition acknowledges completion before displaying the next action. Respect reduced motion.
- Put the full checklist in an optional “All checks” disclosure. Put “Restart setup” in a secondary position, with confirmation after progress; do not make it the primary button.

## Four chapters, nine existing checks

### 1. Camera — `stand`

Headline: **Find your position**

Instruction: “Face your laptop and fit your upper body inside the guide.”

Show a large mirrored self-view with a framing outline. The primary action is Start camera before permission is granted. Once tracking is available, prompt “Hold still” and advance using the existing stand measurement. If tracking is missing, provide one useful correction, such as “Step back until your upper body fits.” Do not invent a fixed physical distance.

### 2. Phone — `phone`

Headline: **Link your saber**

Instruction: “Scan with your iPhone, then tap Ignite saber.”

Make the actual QR code the primary element, around 220–260 px with an intact white quiet zone. Show the pilot callsign for pairing confirmation. Replace the wrapped raw URL with Copy link plus a collapsed Show link option. Keep QR generation and routing from `saberControllerUrl`; never create a second room or controller session for this screen.

Update the guidance as real state changes: “Waiting for your phone” → “Phone linked—tap Ignite on your phone” → “Motion received.” Pairing alone is not motion readiness. On the phone itself, show the real motion permission error and its recovery action if permission is denied.

### 3. Saber — `forward`, `up`, `right`, `reach`

Give each check its own simple animated demonstration and one sentence:

1. **Point at your laptop** — “Hold the phone level. Aim its top edge at the screen.”
2. **Raise your saber** — “Lift the hand holding your phone above your head.”
3. **Point to your right** — “Extend your phone to your right, keeping it level.”
4. **Reach forward** — “Extend your phone toward the screen.”

Use arrows and a highlighted phone-hand, with text specifying the player's right. Show the same action on both devices. Advance only when the existing wizard advances. Keep existing camera fallback notes visible as concise, understandable messages; never turn a timed fallback into a claim that detection succeeded.

### 4. Movement — `open`, `pinch`, `nudge`

Headline: **Train your free hand**

Show open palm → thumb/index pinch → a small nudge. Give each its own screen and the current measured progress. Explain the control before asking for it: “Pinch and nudge to walk. Release to stop.” Reuse a small joystick indicator to preview direction. The current movement model maps screen up/down to forward/back; demonstrate that clearly without promising reliable camera depth.

If hand calibration uses its existing fallback, say “Using default hand sensitivity.” Offer the existing WASD/arrow-key alternative with correct scope. Do not silently skip calibration, change thresholds or introduce a manual Next button that marks a pose successful.

## Completion and failure states

- On completion: **Your saber is calibrated.** Show your real readiness and “Waiting for [rival]” if necessary.
- Enter combat through the existing server phase and readiness conditions. Do not add an independent client countdown or a cosmetic ready button that bypasses those conditions.
- Lost body/phone signal: display a clear recovery instruction based on real available state. Preserve the server's stale-input behavior.
- Keep Restart setup and Forfeit/Return actions distinct. Retrying a pose normally uses the existing automatic progress reset. A true per-check recalibration feature is outside this first UI pass.

## LYRA's role

Use a small LYRA portrait and a concise text cue, such as “Aim the top edge toward your screen.” Keep the instruction visible without sound. Optional spoken cues can follow after the shared Voice server is working: speak once per actual step transition, never for every tracking frame, and never make audio or microphone access a condition of calibration. Do not begin with a new AI-driven setup system.

## Implementation order and owners

1. **Presentation pass — approximately 35–50 minutes:** Alex implements the active-step panel, four chapter indicators, compact device statuses, visible QR and optional full checklist. Add a new `SaberSetupPanel` component and focused `setupPresentation` data in `web/src/arena3d`; wire it into `ArenaDuel` and its CSS. This is a UI adapter over existing state.
2. **Visual guidance — approximately 20–30 minutes:** add lightweight SVG pose demonstrations, real hold-progress feedback, layout for smaller laptops, focus handling, reduced motion and readable contrast. Keep the camera preview unobscured.
3. **Phone alignment and checks — approximately 20–30 minutes:** mirror the concise step wording on `SaberPhone`; verify link, permission and motion states. Justin reviews that setup progression and server contracts remain intact; Alan helps test actual camera/phone framing. These are proposed roles, not messages sent to teammates.

These are effort estimates, not measured completion times. Check existing setup tests and build after wiring. Do not change `setupWizard.ts`, thresholds, pair-code ownership, combat input or protocol as part of the presentation pass without a separate decision.

## Acceptance before calling it done

- A first-time tester understands each action without reading the full list or getting verbal coaching.
- QR and the current instruction are visible together at 1366×768; check a shorter viewport too. Long links and errors cannot push controls offscreen.
- Laptop and paired phone show matching current instructions. Each pose passes only on existing wizard criteria.
- Test both saber hands and the player's right direction. Distinguish mirrored self-view from demonstration direction.
- Exercise camera denial/lost tracking, phone not yet linked, motion not enabled, disconnect/reconnect, default movement calibration and restart. Pending states must not look like errors.
- Both players reach the existing readiness gate and finish a real duel. Record actual setup duration; a first-time setup around 60–90 seconds is a design target, not a claim about current performance.

MVP priority: one action per screen, prominent QR, useful feedback. Pose animations and optional LYRA narration follow that usable core.
