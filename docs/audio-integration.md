# KO.rbit — audio integration handoff

October 18, 2026 · Alex / role D · alex-dev working tree

## Goal, ownership, interface, exclusions, acceptance

Goal: add the supplied audio pack to the actual onboarding → cockpit → travel → saber-arena flow. User authorization covers the UI/audio integration paths across A/C/D ownership.

Owned changes: `web/src/audio`, `web/public/sfx`, and small presentation hooks in onboarding, cockpit, planetary transition, FlightApp, and the LYRA panel. No server contracts, combat rules, networking endpoints, provider credentials, dependency manifests, or lockfiles changed. The existing phone saber audio is separate.

Interface: presentation components call the shared `gameAudio` singleton; `useAudioScene(scene)` leases a music/ambience scene; `play(soundId)` returns a cancellation callback; `duck()` returns a voice-ducking release callback. A scene's old cleanup cannot stop a replacement scene. No audio callback changes gameplay state.

Acceptance: correct scene beds and transition cues; browser gesture unlock; global music/effects mute and per-bus volumes; no stale sounds after skipping/leaving; quiet combat background; preserved wheel cue; relevant tests/build; actual browser asset decoding. Full multiplayer and physical iPhone listening remain device QA.

## What plays where

- Onboarding: `menu_synthwave_calm`. Starts after the first click/key, respecting browser autoplay rules.
- Entering the bridge: `hyperspace_jump_long` begins with the closing/warp sequence; leaving it cancels the remaining tail.
- Cockpit: `menu_outer_space_loop` plus a quiet `cockpit_hum_loop`.
- Accepted/ready matchup: one short `vs_slam_a` clash/impact per opponent-state entry. Ordinary roster changes do not trigger it.
- UI buttons: soft `ui_tap_b` through one document click listener. Disabled controls and the mixer itself do not make automatic click sounds. Pointer and keyboard activation of normal buttons work through the native click event.
- Map wheel: original synthesized ticks and destination lock tones retained. They now use the shared effects/master controls.
- Departure: original low engine accent plus `hyperdrive_charge` on zoom.
- Actual travel video playback: `hyperspace_jump_short` once, with `engine_thrust_loop` underneath. The engine stops on video pause, skip, arrival, or unmount.
- Final 16% of the video: `hyperspace_arrive`. A natural ending permits its short landing tail to finish; an interrupted/skipped transition cancels it.
- Mars briefing: quieter battle track and Mars wind.
- Saber arena: `battle_space_city_115bpm` at a low level plus `mars_wind_loop`. No camera input is needed to start the background bed.
- Results: retains the quiet Mars bed until returning to the cockpit.
- LYRA panel listening/speaking: background music and ambience duck; effects remain separate. The older iframe briefing uses a lower preset background mix; it does not publish real-time voice ducking events.

## Mixer and runtime

One shared browser AudioContext with master, music, ambience, and effects gain buses. The bottom-right SOUND / MIX controls persist settings under `sd.audio.v1` in this browser.

Defaults are linear gains, not dB or measured loudness: master 72%, music 50%, ambience 35%, effects 60%. Tracks have additional per-file gains: onboarding .45, cockpit .34, combat .24; cockpit hum .22, Mars wind .16. This keeps battle music below the action. Audition on the actual demonstration speakers before final tuning.

LYRA ducking multiplies music by .22 and ambience by .35. Leases prevent concurrent voice callers restoring music too soon. The mixer controls background music, ambience, cinematic effects, and the map wheel. LYRA's speech and the phone's synthesized saber hum/clash keep their existing separate controls.

No autoplay bypass or microphone permission request is added. First click/key unlocks Web Audio; Enable sound / Retry sound is available if needed. Browser interruptions return the UI to an unlock action. Hidden pages stop current effects and scene sources; returning resumes only the current beds. Sounds use bounded concurrency and a short per-cue retrigger guard.

Music loads lazily and decoded long tracks are not kept in a permanent cache. Short effects are cached. MP3 is attempted first, with WebM fallback. No Howler or new npm dependency was introduced. Missing audio does not block the game; the listening room shows a load error.

## Listening room

Run the frontend normally, then open `/?audio=check` on that frontend's origin. This page uses the actual mixer and assets without a game connection, camera, microphone, or provider call.

Local built preview for this session: http://127.0.0.1:5195/?audio=check

Choose Onboarding, Cockpit, Briefing, or Battle. Effects can be auditioned individually. The page lists loops only after buffers decode and sources start, and lists the last decoded cue. Simulate LYRA Ducking toggles the background reduction. Use STOP BEDS or SOUND OFF when done.

The main game is http://127.0.0.1:5195/ for this session. A static preview cannot serve the older local `/copilot` proxy. The normal Vite server remains the development route for that fixture.

## Assets and provenance

14 selected sound IDs, 28 MP3/WebM files, approximately 7.7 MB total. Only selected audio files were copied from the user-supplied `Downloads/space-battles-assets/sfx` folder.

`web/public/sfx/manifest.json` retains the selected records' authors, URLs, license declarations, durations, and original filenames. `SUPPLIED-PACK-MANIFEST.md` preserves the full supplied catalog for provenance; some catalog entries are not shipped. These are the pack's declarations, not an independent license audit by this integration.

Music in the supplied manifest comes from third-party creators. Some effects/ambience are labelled Grok Bot generated. This implementation does not make a Grok API request and does not establish any new sponsor eligibility claim. Existing Grok Voice remains separate.

## Files

- `web/src/audio/gameAudio.ts`: shared mixer, source loading, lifecycle, settings, ducking.
- `web/src/audio/gameAudio.test.ts`: lifecycle regression coverage.
- `web/src/audio/useAudioScene.ts`: scoped scene lease hook.
- `web/src/audio/SoundShell.tsx`: first-interaction unlock, light UI clicks, mixer controls.
- `web/src/audio/SoundCheck.tsx`: isolated browser listening room.
- `web/src/audio/sound.css`: scoped mixer/listening-room styles.
- `web/src/main.tsx`: shared shell and optional listening-room route; phone controller retains its existing audio.
- `web/src/onboarding/OnboardingFlow.tsx`: intro bed and bridge jump cue.
- `web/src/ui/screens/SpaceshipHome.tsx`: cockpit/travel beds and accepted-match clash.
- `web/src/ui/cinematics/PlanetarySound.ts`: existing synthesis routed to the mixer.
- `web/src/ui/cinematics/PlanetaryTransition.tsx`: charge, jump, engine, arrival, skip cleanup.
- `web/src/app/FlightApp.tsx`: briefing/battle/result scene beds.
- `web/src/voice/HologramCopilot.tsx`: voice ducking leases.

No new environment variables or server configuration.

## Verification and remaining checks

- Frontend production build/typecheck passed.
- Full frontend suite: 165 passed, 1 opt-in live-network test skipped.
- Mixer lifecycle tests passed: gesture gate, stale scene cleanup, canceled pending cues, stale pending loops, mute, hidden-page cleanup, concurrent voice ducking, saved-volume validation, and missing media.
- All 28 selected MP3/WebM assets exist and have non-empty content. Diff whitespace check passed.
- Browser listening room verified real decoded onboarding/cockpit/battle buffers, cockpit hum/Mars wind, the matchup clash, onboarding jump, rocket charge, short jump, and arrival cue. Browser controls verified music volume adjustment, mute removing scene loops, unmute restoring them, and the ducking toggle. No console warnings/errors in the listening-room checks.
- Production frontend, not Justin's deployed tunnel, was used for local audio QA. The deployed link gains these sounds only after the team pulls the changes and serves/rebuilds this frontend.
- Physical iPhone/Safari playback, speaker balance with two laptops, live LYRA ducking, exact two-player challenge/cinematic timing, and full start-to-finish combat audio need team device QA. Do not claim those from unit tests.

## Quick team test

1. Pull the audio change once committed, install existing dependencies if needed, run the frontend. No new packages or keys.
2. Open `/?audio=check` and compare the three scene beds. Tune Music down if the demo speakers mask speech.
3. Start fresh onboarding, click Begin, confirm the first sound starts; enter hyperspace and check the bridge cue stops at arrival.
4. In Demo or a real accepted match, confirm the clash plays once, wheel cues remain, and travel video has engine/jump/landing sound. Skip once and ensure no engine continues in the cockpit/arena.
5. In a real saber duel, confirm low battle music and wind, readable speech, and existing phone hum/clash. Test mute, background-tab silence, and returning to the cockpit.
