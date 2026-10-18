# Cinematic cockpit → battle jump trial

A separate preview with a 2.2-second default transition. Keeps the cockpit visible while the window becomes hyperspace, briefly projects the matchup onto the glass, then shows Mars arrival and a cosmetic camera-duel handoff. There are 1.8s and 2.6s alternatives. Sound is off by default; optional synthesized low-frequency acceleration/airflow starts only on an explicit play gesture.

## Run / review

`npm install`, then `npm run dev` (http://127.0.0.1:5188). `npm run build` typechecks and builds. Engage jump or Play jump runs once; Hold jump freezes the middle of the effect; Reset returns to the cockpit. Add `?reduce=1` to test the static reduced-motion matchup path. No camera/microphone permissions or provider APIs are used.

## What is reused

The files under src/ui are copies of Ally’s procedural cockpit and supporting screen/texture code from the shared repository. They are here to make the standalone preview look familiar; **do not overwrite those files during integration**. The shared repository was not edited. Mars uses an illustrative procedural texture, not a downloaded planetary dataset texture. Pilot names and the selected world are demonstration constants.

## Actual integration

The effect should be added to the app’s existing SpaceshipScene/Canvas, rather than mounting a second cockpit or WebGL renderer. CockpitScene.tsx demonstrates the camera push/FOV, star-line geometry, tunnel glow and world fade. main.tsx/style.css demonstrate the transparent matchup and arrival HUD timing. Keep only one render loop and dispose the effect objects when the camera duel takes over. Prepare camera access through the real app’s established permission flow; this preview does not claim camera prewarming.

A local preview timer currently marks visual completion. For real multiplayer, B’s authoritative start deadline must drive a shared timeline, adjusted for server clock offset. Do not start combat from a client-only animation callback. Reduced-motion clients should preserve the same server deadline while displaying a static matchup. No server/challenge/Photon/Voice contracts were changed here.

## Checks

Typecheck and production build pass. Browser checked full 2.2s sequence → arrival/handoff; held warp at desktop and 390×844; forced reduced-motion playback retained the same handoff timing. Physical phone/Safari performance remains to be measured. Copied cockpit draws at low quality, capped DPR 1.25, with a single bloom pass. Actual implementation should reuse the already-loaded cockpit and adapt quality to its device budget.
