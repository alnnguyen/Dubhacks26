# Shared button hover treatment

Goal: apply the visual treatment from the user's `Downloads/button-handoff.zip` across buttons on `alex-dev`. Owned paths for this commit: shared button CSS, the main stylesheet import, and these handoff/task-board notes. No server, networking, combat, dependencies, or environment changes.

## Behavior

- Fine mouse hover: scale 1.05 over 220 ms, cubic-bezier(.18,.92,.24,1), cyan edge/glow. Primary onboarding and HUD actions brighten to #a1e5ff with dark ink. Existing layouts, status colors, fonts, and skewed silhouettes remain screen-owned.
- Existing SVG/arrow icons nudge 3 px up/right. Press scales to .97 over 120 ms; keyboard focus gets a 2 px #a6eeff ring. Individual CSS scale preserves positioning/skew transforms. Previously applied HUD scale transforms are replaced during press to prevent double shrinking.
- OS reduced motion and the cockpit's saved reduced-motion setting remove growth and icon travel. Touch gets press feedback without a sticky hover effect. Disabled controls are excluded from the new hover/press effects.
- Imported once in main.tsx, covering onboarding, cockpit, exploration, LYRA, mixer, result/setup screens, and phone-controller buttons without replacing their components or handlers.
- `data-button-feedback="off"` on a control opts out of shared visual feedback.

## Concurrent audio work

The handoff also contains UI sound suggestions. Initial audio integration was tested, but another session then changed buttonFeedback.ts to click-only audio with silent back/cancel controls. Those edits were preserved. The visual commit does not include the working-tree audio files, samples, first-click mixer fix, or ongoing hyperspace asset replacements. No hover tick is claimed in the current source. Shared sound changes should be finalized by that audio task.

## Verification

Production typecheck/build passed (existing exploration chunk-size warning). Current shared audio checks passed 10/10 after the concurrent click-only revision. Browser checked actual onboarding hover: 1.05 growth, #a1e5ff fill, 3 px arrow travel, preserved skew, and 2 px keyboard focus. Captured screenshot in the chat outputs directory. Device/reduced-motion preference QA was not performed; the CSS supports both OS and in-game reduced motion.

Preview: normal onboarding/cockpit. The chat's static local preview is http://localhost:5195/ .
