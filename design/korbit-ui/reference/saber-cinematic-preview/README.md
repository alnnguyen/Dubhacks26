# Saber initiation — cinematic design preview

Open `index.html` in a browser, or serve this folder with a static HTTP server. No install or build is required. The current local preview is http://127.0.0.1:8891/cinematic/.

The direction combines the earlier full-screen onboarding's Orbitron keyword plates with the glass VS trial's translucent red/blue diagonals, holographic line art, laser sweeps, and hyperspace finish.

## Try it

- **Play Reel** plays all nine slides. Pace options are 1.6, 2.6, or 4 seconds per slide. It stops on Ready.
- Chapters and the nine timeline segments jump directly to a step.
- **Move** shows the updated phone joystick direction. Drag the circular pad, or focus it and use arrow keys. Release stops the local movement vector.
- **Ready → Play Arena Entry** plays a 1.8-second star-trail jump.
- Sound starts off; enabling it adds small synthesized cues. Reduce Motion removes the flying and looping effects. The operating system's reduced-motion preference is respected.

## Scope

This is a visual prototype. Camera locks, motion checks, pairing, opponent names, and match readiness are simulated. The QR contains design-preview text, not a live pairing address. There is no camera, microphone, provider, or game-server connection. Google Fonts is the only external asset request; system font fallbacks are provided.

Movement reflects Alex's updated phone joystick instruction. It does not implement that control in the game. Do not port the older free-hand pinch/nudge sequence back into this design.

## Integration notes

Reuse the game's existing scene/renderer. Bind instructional slides to actual camera, phone, motion, and alignment state. Production setup must wait for real checks and provide retries. The reel's timers are for design review; they must not mark a device ready or authorize combat. Match transitions should follow the server's match timing. Keep the original device permission requests on an explicit player action.

## Verification

JavaScript syntax check passed. Browser review verified all nine slides, explicit reel playback through completion, joystick keyboard input and release-to-stop feedback, arena-entry completion, and the reduced-motion toggle. No console warnings/errors were recorded in that verification tab. Desktop layout was visually checked. Physical iPhone touch, Safari, camera, sensors, and real multiplayer remain outside this standalone preview's checks.
