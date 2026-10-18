# Paste into Alan's coding agent

We are building galaxy exploration for KO.rbit. Match the supplied UI handoff, especially `BRAND-GUIDELINES.md`, `GALAXY-EXPLORATION-HANDOFF.md`, and the actual source under `reference/saber-cinematic-preview/`. Open the visual board and cinematic preview to compare the result. The archive contains historical references too; the latest cinematic preview and glass hybrid VS are the preferred direction.

First inspect the current branch, repository instructions, exploration scene, font loading, shared state, existing gameplay controls, and world/challenge contracts. Preserve other teammates' work. This is an integration into the current app; do not replace the game with the standalone preview or restore an older copied cockpit.

The visual language:

- Orbitron 500–900 for display; JetBrains Mono 400/500 for descriptions, telemetry and world data.
- Near-black navy `#020711`; hero white `#f4fbff`; electric blue `#175dff`; cyan `#87dcff`; rival coral `#ff727f`.
- Short italic uppercase hero words on a −12° electric-blue parallelogram. Exact gradient: `linear-gradient(105deg,#0d42c9,#236dff 72%,#4b9aff)`.
- Translucent red/blue diagonal glass, one thin luminous seam, clipped panel corners, understated grid, selected reticle. The world shows through.
- One dominant action, restrained glow, ample dark space. Keep the center of the galaxy clear.
- Reuse the supplied LYRA portrait. Her speech effect follows real audio; text cues must remain visible.

Recommended exploration composition: quiet top rail, navigable galaxy in the center, selected-world glass panel at an edge, compact bottom utilities, small LYRA cue. Show the real selected world, actual data with units/source, and actual gameplay effect. Do not invent dataset values. Keep existing Demo/Live and shared endpoint behavior.

On entry, CHOOSE YOUR / DESTINATION may use the cinematic arrival. On ordinary selection, use a modest 180–250ms transition. Confirmed travel can use a brief laser/warp/arrival based on actual state. The source has a 720ms flying title, 850ms hologram entrance, 650ms laser sweep, and 1.8-second preview jump. Match timings belong to the server; a UI timer cannot authorize a battle.

Current control direction: joystick on the saber phone; drag/hold moves and release stops; phone motion aims the saber. Do not restore old free-hand pinch movement instructions. Reuse the team's current movement command contract; the preview's joystick is illustrative.

Use scoped selectors/tokens and the existing renderer. Enlarge meaningful labels to 12–16px rather than copying decorative microtype. Essential touch targets are at least 44px. Support keyboard focus, reduced motion, safe areas, responsive panels, loading/error/reconnect states, and cancellation of stale transitions. Keep shader/particle decoration within the current performance budget.

Deliver a focused exploration change. Verify against the handoff visually at desktop and phone sizes, run the app's relevant checks, and report changed files, behavior, test results, and remaining contract blockers. Do not change provider keys, production endpoints, or unrelated combat logic to achieve the styling.
