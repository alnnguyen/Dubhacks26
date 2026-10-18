# KO.rbit — Alan's UI handoff

Start with **index.html** in a browser. It is a visual field guide, not a source-code document. Double-click it after unzipping, or use a static server. The preview and field guide require no installation. Google Fonts loads remotely with local fallback families.

## Files

- `BRAND-GUIDELINES.md`: thorough brand/UI specification with exact extracted values and clearly marked recommendations.
- `GALAXY-EXPLORATION-HANDOFF.md`: how Alan should apply the look to exploration, existing contracts, integration order, and acceptance checks.
- `ALAN-AGENT-PROMPT.md`: a ready-to-paste brief for his coding agent.
- `design-tokens.css`: opt-in `.sb-brand` variables; no global selector overrides.
- `design-tokens.json`: the same core design data in machine-readable form.
- `index.html`: visual reference board with typography, swatches, geometry, replayable title/laser specimen, illustrative exploration composition, and screenshots.
- `reference/saber-cinematic-preview/index.html`: latest nine-slide standalone preview, including the phone joystick lesson and arena-entry trial.
- `reference/hybrid-battle-intro/`: original glass VS/cockpit-warp React/Three.js trial, with README and build configuration.
- `reference/flight-intro/`: original onboarding source, including rhombus keyword plates and laser inputs. A component source reference, not a complete runnable app.
- `reference/cockpit-jump/`: previous cockpit-travel trial source.
- `reference/battle-intro/`: earlier VS trial for historical context. Prefer the newer glass hybrid for new work.
- `reference/older-saber-onboarding-plan.md`: earlier planning context; its free-hand movement steps are superseded by the phone joystick direction.
- `screenshots/`: current cinematic, glass VS, older VS, cockpit, and earlier wireframe reference images.

## Open locally

From this unzipped folder:

```sh
python3 -m http.server 8892 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8892/`. Click **Open Cinematic Reel** to see the full sequence. **Play Reel** starts playback; **Move** jumps to the joystick trial; **Ready → Play Arena Entry** runs the short warp.

The earlier React trials have their own package files/README instructions. Dependencies and build output are intentionally excluded. Do not copy an old app wholesale into the active repository.

## Source and scope

Packaged from Alex's local design artifacts on October 18, 2026. New token names consolidate the actual preview's values; they are not claimed to be installed in the game. Exploration composition, readable gameplay type sizes, semantic success/caution colors, and build recommendations are proposed extensions.

The current preview simulates device setup and opponent state. Its QR contains safe design text and is not a pairing link. Its phone joystick moves only the local demonstration. No camera, microphone, Photon, Grok, server credentials, or live multiplayer integration is included. LYRA's portrait is the user-selected supplied project asset.

Current control direction from Alex: joystick on the phone controls movement; phone motion aims the saber. Retain the team's existing network command contracts when implementing it.

## Verification

Preview JavaScript syntax check passed. Browser checks verified the full nine-slide reel completes, joystick keyboard input changes the movement state and release stops it, the arena-entry transition completes, and reduced motion toggles. The verification tab reported no console warnings/errors. Desktop preview was visually inspected. Physical phone, camera/sensors, and live multiplayer were not tested by this design package.

Use the brand guidelines as an implementation reference and the source CSS/keyframes as the authority for exact effects. Do not replace current gameplay/cockpit code with historical reference copies.
