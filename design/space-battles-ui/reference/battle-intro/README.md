# Match-found VS intro — standalone preview

A 2.6-second default sequence: red/blue diagonal split, original vector fighter ships, accelerating engine trails, one impact flash, four laser slashes, slanted pilot nameplates, a giant VS slam, then boost/panel exit into a handoff screen. It is a visual prototype, not a real match or networking implementation. The game repository is untouched.

## Preview

`npm install` then `npm run dev` (http://127.0.0.1:5187). `npm run build` typechecks and builds.

The page initially holds the VS frame for inspection. Play intro runs once. Hold VS restores the poster. Length offers 2.2 / 2.6 / 3.0 seconds; Sound on enables optional original synthesized whoosh/impact cues for subsequent plays. Audio defaults off and requires a user gesture. Late join +1.2s demonstrates seeking into the same timeline and only waiting its remaining time. Add `?reduce=1` to exercise the reduced-motion path without changing OS preferences.

## Drop-in component

Copy `src/MatchIntro.tsx`, `src/Ship.tsx`, `src/match-intro.css`. Requires React only, with no extra animation package or WebGL. Fonts are loaded in the standalone index; the app should load Orbitron / JetBrains Mono once in its own entry. `sound.ts` is an optional independent helper; preview controls and main.tsx are not part of the game component.

Props: `self` and `opponent` are `{callsign, shipName}`. `durationMs` defaults to 2600. `elapsedMs` defaults to zero, `paused` defaults false, `reducedMotion` defaults false. `onComplete` marks the cosmetic handoff. Sanitize pilot names through the app's existing identity code. Unmount after completion. The two phones must use the same duration.

## Real match integration boundary

The actual app/server must provide a shared scheduled start, plus a server-clock offset estimate. Derive elapsedMs = max(0, adjustedServerNow - introStartAt). The component seeks CSS animations via negative delay and completes after max(0, durationMs - elapsedMs). If already late beyond the deadline, it renders no intro and completes immediately. Reduced motion fades a static matchup card while keeping the same scheduled end; it does not enable early attacks. Do not start authoritative combat from a cosmetic browser callback: B's server remains responsible for ready/start/attack legality and snapshots. No match_found message or server contract was changed by this preview.

## Assets and checks

Ship SVGs and synthesized sounds are original source in this package. No Kenney assets or third-party UI component source was downloaded or installed. Decorative stars/speed lines use SVG/CSS. Browser checks covered full 2.6s playback → handoff, late-arrival playback, 390×844 layout, and forced reduced-motion playback/handoff. Typecheck and production build passed. Phone-sized desktop emulation is not a physical iPhone performance or Safari test.
