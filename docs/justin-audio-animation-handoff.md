# Justin — audio and animation handoff

Branch: `alex-dev`. Audio is integrated into the normal frontend; the design previews are separate references. No new dependencies, environment variables, keys, backend contracts, or combat rules.

## Bring this into your branch

From your own feature branch, fetch and merge the shared work:

```sh
git fetch origin
git merge origin/alex-dev
```

Serve or rebuild the updated **frontend** to hear it on your public link. The sounds do not require a new game-server API. Existing Grok speech still requires the Voice-capable backend; this audio change does not fix or alter that provider path.

## Working audio

- First click/key unlocks sound. Onboarding has calm music and a bridge-entry hyperspace cue.
- Cockpit has a space music bed and low ship hum.
- Accepted match plays one clash cue; normal buttons make light clicks.
- Map-wheel tick/lock synthesis is preserved and uses the shared mixer.
- Travel video has charge, jump, engine, and arrival effects; skip/pause/unmount stop obsolete cues.
- Arena has quiet battle music and Mars wind. The phone retains its existing saber hum/clash/hit audio.
- SOUND / MIX at the bottom right controls music, ambience, effects, master level, and mute. LYRA panel listening/speaking ducks the background.

Open `/?audio=check` on your frontend to audition the actual tracks and cues without joining a match. Full mapping, files, mixing defaults, provenance, and remaining device QA: `docs/audio-integration.md`.

## Animation and brand references

- Existing game onboarding: `web/src/onboarding/`.
- Existing game planet wheel/travel: `web/src/ui/cinematics/`.
- New visual field guide: `design/korbit-ui/index.html`.
- New nine-slide saber-setup reel: `design/korbit-ui/reference/saber-cinematic-preview/index.html`.
- Earlier glass VS / hyperspace source: `design/korbit-ui/reference/hybrid-battle-intro/`.
- Typography, colors, spacing, component recipes, exact motion timing: `design/korbit-ui/BRAND-GUIDELINES.md`.
- Galaxy exploration brief and agent prompt are beside that guide.
- `web/duel-result-preview.html` is a separate draft result-screen preview, not wired to live results.

The new saber reel simulates setup. Its joystick explains the updated phone control direction, but copying this handoff does not replace the existing live calibration screen or implement a new movement command. Never use design-reel timers to mark a player ready.

To view the field guide and its linked previews:

```sh
python3 -m http.server 8892 --bind 127.0.0.1 --directory design/korbit-ui
```

Open http://127.0.0.1:8892/. The static HTML guide/reel need no build. Historical React/Three.js references have their own package/README files; reuse visual pieces in the current renderer rather than overwriting active gameplay with an older scene copy.

## Verify before the demo

Check fresh onboarding, one accepted challenge, map selection, travel plus skip, arena, and return. Compare the mix on the actual two laptops and iPhones. Test LYRA ducking, mute, and background-tab silence. These physical-device and end-to-end live checks remain open; local build/tests and the audio listening room are verified separately.
