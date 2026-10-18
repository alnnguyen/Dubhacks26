# Glass VS → hyperspace → Mars

Standalone 2.6-second visual trial. Reuses the first VS preview's diagonal red/blue layout and ship silhouettes, with translucent glass panels, dark holographic hulls, thin accents, and the existing cockpit visible behind them. The matchup leaves first, then the ship accelerates into hyperspace and arrives at Mars. Previous previews and the shared game repository remain untouched.

## Preview

`npm install`, then `npm run dev` (http://127.0.0.1:5189). `npm run build` typechecks and builds. Play jump runs the sequence; Hold VS and Hold warp freeze their respective phases. Duration options: 2.2, 2.6, 3.0 seconds. Sound is optional and off by default. Reset returns to the contact screen. `?reduce=1` exercises static reduced motion with the same completion deadline. No camera, microphone, provider, or account access is used.

## Sequence at the default 2.6 seconds

- 0–1.0s: red/blue glass panels, ship fly-ins, slanted nameplates and large VS.
- 1.0–1.3s: panels and ships leave as the hyperdrive starts.
- 1.3–2.1s: forward camera push, star trails and tunnel glow.
- 2.1–2.6s: deceleration, Mars arrival and preview handoff.

## Integration

Files under src/ui are copies of Ally's procedural cockpit and supporting code. Reuse the game's existing cockpit/Canvas when integrating; do not overwrite those files or mount a second WebGL renderer. CockpitScene.tsx contains the camera, star trails, tunnel, and illustrative Mars globe; main.tsx/style.css contain the matchup and arrival overlays. Pilot names/world are demo constants; the Mars texture is generated art rather than a scientific dataset.

The standalone timer proves the visual sequence only. Production must derive elapsed time from B's authoritative match start deadline with server clock adjustment. The animation callback must not authorize combat. Reduced motion should preserve the deadline and show a static matchup. The camera-duel handoff is cosmetic in this trial.

## Verification

Typecheck and production build pass. Checked desktop 1280×800, phone viewport 390×844, both held phases, full playback to Mars, and reduced-motion completion. Physical phone/Safari performance still needs measurement. Dependencies are shared locally through a node_modules symlink for this workspace; the source ZIP omits dependencies and built output.
