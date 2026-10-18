# KO.rbit — UI & motion guidelines

Version 1 · October 18, 2026 · Handoff for Alan and the team

This documents the actual cinematic saber-initiation preview and the earlier **Glass VS → hyperspace → Mars** trial. The cinematic preview is the primary visual reference. Exploration recommendations below extend that system; they are not claims about features already integrated into the game. “KO.rbit” is the working display name. NIGHTFALL, NOVA-7, VEX, and SD / 26 are sample labels, not new required product names.

## 1. The visual idea

**A flight deck projecting bold mission graphics onto glass.** Almost-black navy gives the scene depth. Huge white, slanted words fly onto electric-blue parallelograms. Translucent red and blue panes divide the scene diagonally. Thin laser lines, restrained holographic diagrams, and sparse telemetry make it feel like a ship interface. The world remains visible behind the UI.

The hierarchy is: one important action or destination; one short instruction; a supporting visual; then quiet system detail. Large typography marks an arrival, matchup, or milestone. During exploration, the map and selected destination take priority.

Use these five signatures consistently:

1. Orbitron display lettering, uppercase and italic on cinematic titles.
2. Electric-blue keyword plates skewed −12°.
3. Translucent diagonal red/blue glass with a fine luminous seam.
4. JetBrains Mono for instructions, data, and system labels.
5. A short coordinated entrance: title, hologram, details, laser sweep.

## 2. Typography — exact preview settings

### Font loading

Display family: **Orbitron**, weights 500, 600, 700, 800, 900. Fallback: `system-ui, sans-serif`.

Instruction/data family: **JetBrains Mono**, weights 400, 500. Fallback: `monospace`.

The source loads Google Fonts with this stylesheet:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

The source requests `font-style: italic` on display text, but does not load a dedicated italic font file and sets `font-synthesis: none`. Do not depend on browser-generated italic: the plate’s −12° transform supplies the consistent visible slant. Use the supplied preview to match the appearance rather than adding another arbitrary skew to the word.

### Display roles

- **Hero keyword:** Orbitron 800; `clamp(39px, 6.1vw, 104px)`; italic; letter spacing `−0.055em`; white `#f4fbff`; nowrap. The surrounding heading has line height 1.1. Example: TO MOVE.
- **Hero lead:** Orbitron 500; `clamp(17px, 2.3vw, 34px)`; italic; tracking `0.08em`; bottom margin 13px. Example: SWIPE.
- **VS:** Orbitron 800; 100px in the compact onboarding visual; tracking `−0.1em`; transform `translate(-50%, -50%) rotate(-12deg) skewX(-10deg)`. The full-screen hybrid VS uses weight 900 and `clamp(100px,15vw,210px)`.
- **Pilot nameplate:** Orbitron 800; 26px; italic; on a −12° glass plate. Full-screen matchup nameplates use `clamp(32px,5.3vw,80px)`.
- **Primary action:** Orbitron 600; 9px in this art-direction prototype; tracking `0.1em`. See production adjustments below before using this size for gameplay controls.

### Supporting roles

- **Description:** JetBrains Mono 400, 14px, line height 1.8, `#a0b7d1`, maximum width 46 characters. Sentence case.
- **Eyebrow:** JetBrains Mono 400, 9px, line height 1.8, tracking `0.18em`, `#7ba8cd`, uppercase.
- **Status:** JetBrains Mono 400, 8px, tracking `0.02em`, `#8eb1d2`.
- **LYRA cue:** JetBrains Mono, 10px, line height 1.65, `#779cb8`; her label is 7px with `0.14em` tracking.
- **Decorative telemetry:** 6–8px Mono in the preview. Suitable for visual texture only; never hide an essential instruction at that size.

### Recommended gameplay sizes

These are new handoff recommendations, larger than some prototype microcopy: 14–16px for essential instructions and buttons, 12–14px for meaningful map data, 18–28px for section/destination headings. Reserve the 39–104px treatment for a short selection banner or transition. Keep atmospheric labels small only when the user can ignore them safely.

Use uppercase for names, commands, headings, and short labels. Use sentence case for explanations. Avoid paragraphs set in widely tracked uppercase. Long player names should truncate in persistent HUD slots; destination titles can wrap before the highlighted keyword. Do not shrink essential copy indefinitely to preserve a cinematic composition.

## 3. Color system

### Primary tokens extracted from the preview

- **Void:** `#020711` — page and deep-space background.
- **Main ink:** `#e9f6ff` — root foreground.
- **Hero white:** `#f4fbff` — keyword lettering.
- **Electric blue:** `#175dff` — brand energy and selected emphasis.
- **Hologram cyan:** `#87dcff` — active guidance, tracking, vector detail.
- **Rival coral:** `#ff727f` — rival identity and adversarial accents.
- **Muted steel:** `#6f96b8` — secondary decoration.
- **Body ink:** `#a0b7d1` — explanatory copy.
- **Label ink:** `#7ba8cd` — eyebrows and supporting metadata.
- **Control surface:** `#0a192b` — compact utility controls.
- **Control border:** `#2b4766` — structural borders.
- **Primary fill:** `#e2f2ff`; **primary ink:** `#06162d`; **hover fill:** `#a1e5ff`.
- **Keyboard focus:** `#a6eeff`, 2px outline, 4px offset.

### Gradients and alpha

Keyword plate: `linear-gradient(105deg, #0d42c9, #236dff 72%, #4b9aff)`.

Red glass: `linear-gradient(130deg, #11091444, transparent 48%, #811e3545)`.

Blue glass: `linear-gradient(120deg, #07183fcc, #0b245844 60%, #02081199)`.

Hologram stage: `linear-gradient(125deg, #112c4a44, #02081211)`.

Eight-digit hex is **RRGGBBAA**: `44` is about 27% alpha; `55` 33%; `66` 40%; `77` 47%; `88` 53%; `99` 60%; `cc` 80%; `e8` 91%. Do not convert these panes to solid red/blue fills: the scene showing through is part of the effect.

### Semantic additions for exploration

The preview has no complete validation/error palette. Proposed additions: success `#79e7b2`, caution `#ffd28a`, danger `#ff727f`. Pair every color with text or an icon. Rival identity already uses coral, so “rival present” and “connection error” need distinct labels. A new orange planet should not turn all surrounding controls orange; let the world supply environmental color while the UI stays blue/cyan.

## 4. Geometry, glass, and depth

**Keyword plate:** `skewX(-12deg)`; fit-content width; padding `9px 25px 14px 20px`; top border `1px solid #9fd5ff66`; shadow `0 12px 65px #195dff25`. Its sheen crosses once after arrival. Keep copy and input fields outside the transformed plate.

**Diagonal scene split:** red upper pane `polygon(0 0,100% 0,100% 26%,0 67%)`; blue lower pane `polygon(0 67%,100% 26%,100% 100%,0 100%)`. The earlier hybrid VS uses 31% and 74% as its split points. They share a direction, not an identical polygon.

**Seam:** 1px high; width 140%; left −20%; top 47%; rotate −16°. Gradient passes from transparent through blue, pale cyan, coral, then transparent. Small blue glow. It divides atmosphere rather than becoming a thick ribbon.

**Holographic panel:** clipped lower-right corner: `polygon(0 0,100% 0,100% calc(100% - 24px),calc(100% - 24px) 100%,0 100%)`. Fine blue left edge and faint red right edge; a 28px square grid at low opacity. Mostly square corners; circles belong to reticles, orbits, joystick pads, and status dots. The rounded phone is a physical-device illustration, not the general panel style.

**Depth order:** stars → horizon/grid → tinted glass → fine structural lines → world/illustration and copy → transient laser → transition flare → utility dock. Decorative layers use `pointer-events:none`. In exploration, the live world replaces the illustrative stage behind DOM overlays.

Glow is selective: blade core, selected destination, active line, short entry flare. Avoid giving every panel and every word its own bright halo. The dark area around a bright element makes it feel luminous.

## 5. Layout and spacing

Actual desktop preview: content max width 1500px; shell side padding 5vw; two columns `1.15fr 1fr`; column gap 3.5vw; stage minimum height `calc(100dvh - 230px)`. Masthead margin `25px 4vw 0`, bottom padding 18px. Chapters margin `18px 4vw`, 26px gaps. Description top margin 25px. Primary action top margin 20px. LYRA top margin 25px. Bottom dock minimum height 76px.

Proposed reusable spacing scale: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64px**. This scale consolidates the direction; the original prototype contains optical adjustments outside it.

At widths up to 1000px, the preview reduces descriptions and utility controls. At 700px and below it stacks copy above illustration, uses an 18px lead and `clamp(38px,10.5vw,72px)` keyword, and allows vertical scrolling. At desktop heights up to 760px, it shortens the illustration and spacing. These are source breakpoints, not a guarantee of every device's layout.

For the actual phone controller, give meaningful controls at least 44×44 CSS pixels, account for safe-area insets, and keep touch surfaces unskewed. For laptop exploration, leave the center of the map open; place navigation and selected-world details around its edges. A persistent HUD should take less space than the cinematic slides.

## 6. Component recipes

### Mission heading

Eyebrow → short lead → one highlighted keyword → one sentence → one action. One plate per focal area. Examples: CHOOSE YOUR / DESTINATION; APPROACHING / MARS; RIVAL / DETECTED. Two large competing plates destroy the hierarchy.

### Primary action

Pale ice fill, dark ink, −12° silhouette, spaced Orbitron label, small arrow at right. Hover shifts fill toward cyan. Preserve a clear focus ring. For production touch controls, keep the hit target rectangular and readable even if a decorative child is skewed.

### Secondary action and chapters

Dark navy fill and thin steel border for utility controls. Chapters are quiet text with an active cyan underline. Show one current location; do not make every tab glow. Disabled controls explain why when the reason matters; reduced opacity alone is insufficient.

### Holographic visual

Simple fine-line SVG silhouette with a bright active limb/object, a dim contextual outline, a few small joints, and a slow scan/orbit. Camera guidance must say “your right” when screen mirroring could confuse the player. Decorative guides must not imply that a real camera or sensor lock has succeeded.

### Status/readiness

Small square + explicit label + a slim meter when progress is measurable. The preview meter is 62×2px. Persistent game status can be larger. Real states should read clearly: CONNECTING, LINKED, MOTION REQUIRED, READY, RETRY. Never animate to 100% on a timer and present it as device validation.

### LYRA

Use the supplied blue hologram portrait consistently. The small preview portrait is 40×46px with an elliptical fade, beside a small identity label and one short cue. Preserve its proportions; do not replace her with a generic unrelated face. Idle can have a subtle scan/pulse. Speaking state should follow actual audio playback, stop on interruption, and retain text. This preview has text cues only; it does not contain synthesized dialogue or a working voice session.

### Planet or rival selection

Use the clipped holographic panel, Orbitron name, Mono metadata with units, and a single main action. Selected gets cyan edge and reticle; nearby gets a quiet outlined marker; rival gets coral plus identity label. Loading, unavailable, and stale data get explicit copy. Illustrative numbers must be labelled as samples.

## 7. Motion specifications — actual preview

- **Keyword arrival:** 720ms; easing `cubic-bezier(.18,.92,.24,1)`. Starts at `translate3d(100vw,55px,-300px) rotate(-6deg) scale(.75)`, opacity 0 and 10px blur. Ends at rest, opacity 1, no blur. The plate's −12° skew stays in place.
- **Hologram arrival:** 850ms with 120ms delay; easing `cubic-bezier(.15,.8,.2,1)`. Starts 120px right, 20px up, 130px back, rotateY −16°, scale .87, 5px blur.
- **Eyebrow:** 500ms, 100ms delay. **Description:** 550ms, 350ms delay. **Status:** 550ms, 400ms delay. **Action:** 550ms, 450ms delay. **LYRA:** 600ms, 500ms delay. Details fade and rise 13px.
- **Laser sweep:** 650ms ease-out; −14° diagonal; moves −130% to +130%; opacity peaks around 30%. One 2px core plus a faint secondary line 8px below.
- **Plate sheen:** 1100ms with 300ms delay; one pass from −120% to +120%.
- **Phone hover:** 5 seconds, ease-in-out; roughly 7px rise. Off on the phone layout and interactive joystick model.
- **Hologram scan:** 3 seconds. **Orbit:** 24 seconds. **Intro ring:** 17 seconds. **Instruction arrow dash:** 1 second. All are low-priority decoration.
- **Idle joystick hint:** 3.5 seconds; cancels when the user interacts. Actual thumb motion follows input directly.
- **Arena-entry preview:** 1800ms. Star acceleration and a soft flare; content fades away over 300ms. Reduced-motion completion is 350ms.
- **Design reel pace:** 2600ms per slide by default; review alternatives 1600ms/4000ms. These are presentation timings, never real setup deadlines.

Earlier full-screen hybrid trial: **2600ms total**. Rough sequence: 0–1000ms glass matchup, 1000–1300ms panels leave/drive starts, 1300–2100ms warp, 2100–2600ms Mars arrival. Refer to its source for exact percentage keyframes. Keep a gameplay jump brief and tied to the actual accepted match.

For exploration, use the full title entrance once on entry or confirmed destination travel. Small selection changes should use a restrained 180–250ms fade/slide instead; this is a recommended extension. Do not replay a full-screen laser show on every planet hover.

## 8. Movement and interaction direction

Current agreed instruction: **thumb drag on the saber phone controls movement; phone motion aims the saber**. Hold the joystick away from center to move; release to stop. Keep movement and swing calibration visually distinct. Remove the older open-palm/pinch/nudge movement lesson from the redesigned flow unless the team explicitly changes controls again.

The preview's joystick is a local demonstration: unit-circle clamp; 0.08 per-axis dead zone; threshold 0.25 marks the demonstration tried; pointer up/cancel/lost capture and blur zero input; arrow-key release stops. These are prototype values to inspect, not a new server command contract. Alan and B must reuse the agreed gameplay command path and coordinate conventions.

## 9. Accessibility and runtime behavior

Respect `prefers-reduced-motion`. Offer a visible motion setting. Stop flying text, star acceleration, looping scan/hover, and laser streaks under reduced motion; retain the instruction and a clear selection state. Do not depend on motion or color alone to explain controls. Keep pointer/touch controls usable and keyboard focus visible.

The prototype's muted microcopy has not been accessibility-certified. Before production, test text contrast against the darkest and brightest scenes, enlarge meaningful labels, and put a darker scrim under text when a planet passes behind it. Avoid rapid flashing. Pause low-priority animation when hidden. Sound starts off and should follow a user gesture; speech needs captions and a mute/interrupt path.

The preview uses a 2D Canvas starfield: 180 points, DPR capped at 1.5, roughly 30fps, drawing skipped when hidden. Hologram art is SVG; UI is CSS/DOM. Exploration should reuse the existing Three.js scene/camera/renderer if one is already mounted. Do not add a second continuous WebGL scene just for this UI.

## 10. Copy and naming

Write like a calm ship copilot: direct, short, useful. “Choose a destination.” “Drag to move. Release to stop.” “Challenge sent. Waiting for VEX.” Prefer an action plus its next outcome. Use atmospheric labels where they help: FLIGHT DECK, COMBAT LINK, MOVE VECTOR, DESTINATION LOCKED. Keep backend/provider terminology out of ordinary player prompts.

Real world facts should show units and source context. Do not call an illustrative Mars image a dataset-driven terrain. If gravity affects gameplay, the applied multiplier and its relationship to the physical value should be explicit in the world panel or briefing.

## 11. Source-of-truth map

- `reference/saber-cinematic-preview/`: latest visual direction, phone movement slide, exact CSS/keyframes, SVG art, QR demo, LYRA asset.
- `reference/hybrid-battle-intro/`: glass VS → cockpit warp → illustrative Mars, original React/Three.js source.
- `reference/flight-intro/`: original oversized onboarding keyword plates and laser inputs.
- `reference/cockpit-jump/`: quieter cockpit travel treatment and source scene.
- `reference/battle-intro/`: earlier bold VS trial for historical reference; prefer the translucent hybrid and current cinematic preview for new work.
- `screenshots/`: visual reference images; source remains authoritative for motion.
- `design-tokens.css` and `design-tokens.json`: named handoff tokens derived from this preview. These are newly consolidated names, not variables already installed in the game.

Archive copies are reference material. Do not overwrite active gameplay files with an older scene copy. Integrate the visual pieces into current components and contracts.
