# Alan — galaxy exploration handoff

## Target

Make exploration feel like the same ship that runs the saber-initiation reel and glass VS animation: a navigable galaxy behind translucent, angular flight-deck graphics. Keep the map usable while reserving the large flying title treatment for a meaningful arrival or travel transition.

Use **Orbitron + JetBrains Mono**, void navy, electric-blue plates, cyan guidance, coral rival accents, fine grids, clipped corners, and the existing LYRA portrait. Exact source values are in `BRAND-GUIDELINES.md`. Open `index.html` for the visual reference board and `reference/saber-cinematic-preview/index.html` for the full reel.

## Suggested screen composition

**Top rail:** product mark on the left; current sector or selected world; one connection/readiness indicator on the right. Quiet typography and one thin structural line. Avoid a large permanent header covering the galaxy.

**Center:** the existing interactive galaxy/world scene. Planet silhouettes and orbit lines remain distinguishable. A selected destination gets one cyan target bracket/ring, its name, and a clear way to inspect it. Reserve red/coral for an opponent or contested destination.

**Selected-world panel:** clipped lower-right glass panel at an edge of the screen, with world name, a brief description, relevant data with units, one gameplay effect, and one primary action. Illustrative layout copy:

```text
DESTINATION / SELECTED
MARS
Gravity: [value] m/s²
Arena effect: [actual configured effect]
Source: [actual dataset / record]
[ CHART COURSE ↗ ]
```

Values above are placeholders for the structure, not validated data. Use the team's real loaded record and actual game effect. Show loading, unavailable, and stale states explicitly.

**Lower utility rail:** small map controls, back/cockpit action, and any existing Demo/Live setting. Reuse the current mode controls and shared endpoint handling. Do not create a parallel multiplayer mode or switch endpoints silently during navigation.

**LYRA:** compact portrait/cue near a corner that does not overlap map controls. Selecting a world can update her text cue. Speaking animation follows actual audio playback. Keep her optional and collapsible if the screen gets crowded.

## Interaction sequence

1. **Enter exploration:** title briefly reads CHOOSE YOUR / DESTINATION. Play the plate entrance once, then settle into a compact heading so the world is visible.
2. **Browse:** pan/rotate/select using the current scene's control model. Hover is a small highlight; it does not trigger a full cinematic. Do not add gesture requirements without confirming the active controls.
3. **Select:** persistent cyan selection ring; world panel updates with a short 180–250ms fade/slide. Keep camera transitions modest and interruptible while browsing.
4. **Confirm travel:** only after the actual action is accepted, show DESTINATION / LOCKED, a single laser sweep, and a short warp. An existing travel sequence should be reused if present.
5. **Arrive:** readable world name, a short practical briefing, then hand control back. Render the accepted world from actual state; do not hard-code Mars into every arrival.
6. **Challenge, when supported:** selected rival → challenge sent → waiting → accepted/declined/expired. Run the red/blue VS sequence after acceptance according to B's authoritative timing. A cosmetic callback never starts combat by itself.

These are design recommendations for the exploration work. Retain the team's current scope and contracts; do not introduce planet ownership, troop simulation, or GPS travel as part of this UI handoff.

## What to reuse

- Title silhouette and exact motion: `.word-flight`, `.word-plate`, `word-arrive` in the cinematic CSS.
- Glass split, seam, background depth: `.glass-red`, `.glass-blue`, `.seam`, `.horizon`.
- World/illustration surface: `.visual`, `.visual-meta`, `.visual-footer`; translate these styles into a persistent panel rather than keeping the slide's full height.
- Action styling: `.primary` and secondary controls, with larger production labels and touch targets.
- Match presentation: the `hv-*` overlay in the hybrid VS source. Reuse current game models/cockpit; its copied scene is historical.
- LYRA: supplied `assets/lyra.png`, with its existing visual identity.
- Font import: the link documented in the brand guidelines. Load once in the app, not once per component.

## Suggested build order

1. Establish a scoped root such as `.galaxy-exploration`; import shared tokens without changing global app selectors.
2. Match the dark background, font families, hierarchy, and glass panel. Start with a real selected-world record.
3. Hook up selection and selected-world details to the existing store/events; verify loading/error states.
4. Add only the entry plate and subtle selection transition.
5. Reuse travel/match transitions against real state. Test interruptions and repeated selection.
6. Connect LYRA cues if the current copilot interface supports them. Do not invent new provider endpoints for the styling work.

## Coordinate with the team

Alan owns the exploration presentation and its existing control/scene integration. Ask B for the authoritative world identifier, dataset record shape, challenge state, and travel/match timestamps if these are not already frozen. Ask A where exploration mounts and how to return to the cockpit. Alex/D owns the provider-backed copilot/Photon path. Reuse their established APIs.

Movement direction from Alex: the saber phone has a thumb joystick. Drag/hold moves; release stops; phone motion aims the saber. The latest preview uses that explanation. Its local joystick math does not establish the game's network contract.

## Readability and performance

The full hero treatment belongs to transitions. Use 14–16px for primary controls/instructions, 12–14px for meaningful data, and 18–28px for ordinary headings. A live HUD does not need the prototype's 6–9px decorative typography.

Keep a darker scrim under readable text. Use a symbol/label as well as color for a rival or warning. Keyboard focus must remain visible. Touch targets should be at least 44px. Respect reduced motion, safe-area insets, and smaller screens. Make panels collapsible rather than covering the map on a phone.

Use the current renderer; no second full-screen WebGL canvas. Use DOM/CSS for panels and SVG for fine UI art. Reuse textures and cap decoration. Avoid continuous React state updates just to animate a background scan line. Hide/pause decorative work when the page is not visible.

## Acceptance checklist

- Fonts, blue plate, glass tint, corner cuts, and one bright focal point match the supplied reference.
- The central map remains visible and selectable.
- A real selected record drives the world name/data/effect panel.
- All important measurements have units and honest source context.
- Loading, failed load, no selection, waiting challenge, declined/expired, and reconnect behavior are readable where applicable.
- Selection does not fire a full cinematic repeatedly.
- Actual phone movement instructions say joystick/swipe, without the old free-hand pinch sequence.
- Travel and battle handoff follow actual state; timers remain presentation-only.
- Reduced motion retains all information and control.
- Test desktop, a short laptop viewport, phone layout, keyboard navigation, and physical phone input as applicable. Build/test the changed app before merging.
