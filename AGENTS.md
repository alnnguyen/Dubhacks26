# Shared agent instructions — KO.rbit

## Source of truth

Read PLAN.md before editing. This project is a React/TypeScript browser camera duel with a persistent Node/WebSocket server. Do not implement Swift, ARKit, campus navigation, planet ownership or autonomous armies from previous brainstorms. This scaffold has no runnable app yet; report missing setup accurately.

## Ownership

- A: web app setup/composition, lobby, ui, public/assets, shared styling, frontend deployment, README and submission.
- B: server setup, game, sessions, web/src/networking, packages/contracts, packages/physics, backend deployment and server validation.
- C: web/src/camera, vision, overlay and public/models. A assists with cosmetic effects after the lobby works.
- D: server/src/integrations, web/src/voice, sponsor adapters and evidence.
- Shared root manifests, lockfile, tsconfig/build tooling and shared dependencies: A/B coordinate before changing.

Stay in assigned paths unless the human task explicitly authorizes cross-boundary work. Member B coordinates shared contracts. Never silently change the interface another teammate is using. Record the decision in docs/contracts.md and notify the affected owner through the team's existing coordination workflow.

## Working style

One human-owned branch/worktree per bounded task. Avoid multiple agents editing the same files concurrently. Inspect existing code first. Preserve unrelated changes. Use small commits/integrations and verify the affected deployed flow; do not rewrite another owner's module to make a mock pass.

Every task states goal, owned paths, interface, exclusions and acceptance check. Handoff: changed files, checks actually run, result, new environment variables and blockers. docs/task-board.md records real status. No autonomous deployment, external messaging or spending beyond the current user's authorization.

## Game invariants

Server chooses the world once and owns health, cooldowns, attack timing and winner. Sessions authorize player actions; client-provided camera detections are not trusted proof of a hit. Button, gesture, Photon and Voice requests use the same validated command path. Duplicate commands/messages must not repeat damage or acceptance.

Hand-tracking loss cancels/times out a held rock rather than launching. Keep touch alternatives. Screen-space overlays are not physical distance or shared-room reconstruction. The gravity timing formula is a game design mapping from real NASA values, not an exact physical throw.

## Providers and security

Keep permanent provider keys on the server. Do not put keys in browser-prefixed variables, fixtures, screenshots or committed files. Local camera inference handles live gestures; remote models stay outside combat timing. Use current provider docs and workshop access, verify incoming events as supported, add timeouts/deduplication and label mocks. MediaPipe is not the Perceptron integration; Grok API characters are not automatically the official Grok Bot.

## Checks and evidence

No run/build/test commands exist yet. A/B must record verified commands in README.md after initializing tooling. Run build/typecheck plus relevant rule tests once available. Prioritize duplicate commands, cooldowns, challenge authorization, gravity mapping and reconnect. Test camera, audio and the full flow on actual phones. Never claim a feature works from compilation alone.

Log actual Cursor use in docs/cursor-usage.md and actual integration evidence in docs/sponsor-evidence.md. Do not fabricate tool usage or model results. Respect the 10 p.m. feature freeze and the cut order in PLAN.md.
