# Mars arena presentation layer

All new effects are in this directory. `config.ts` is the single master/per-effect/quality control surface. Low is automatic for coarse pointers/small screens; PerformanceMonitor can downgrade high → medium → low. Basic Graphics uses low and omits atmosphere/postprocessing. Canvas retains DPR [1, 1.5]. No dependency was added.

## Read-only wiring

- `arena3d/ArenaScene.tsx`: wraps the rendered scene in VfxProvider, passes the existing flashRef and already sampled frameRef into VfxLayer, reports ground height, and wraps each drawn avatar in an identity-at-rest HitReaction child. Its original camera-follow math, frame sampler, body placement and blade/trail updates are unchanged. The original impact and bloom remain the master-off fallback.
- `arena3d/ArenaDuel.tsx`: adds `damage`, `targetSlot` and cosmetic `isKill` metadata to the existing local ImpactFlash assignment in the existing onSaberResolved listener. No new game/network event is emitted. Finishing-hit flair is a conservative comparison with the last authoritative health snapshot; it never declares a winner or changes health.
- `arena/mars/MarsEnvironment.tsx`: optional `dustEnabled`, default true. Only the arena disables its old dust when using the new two-draw-call atmospheric layers. Other consumers keep their existing visuals.
- `app/FlightApp.tsx`: mounts KillingBlow, a pointer-transparent observer of the existing finished/knockout PlayerView. The result screen appears immediately, with a 0.5s cosmetic overlay; no state transition is delayed.

No server, contracts, networking, vision, controls, physics, health, cooldown, authoritative timing, movement or collision code changed. No new wire events or commands. Audio uses the existing unlock/mute/bus settings and prebuilt bounded voices, never requests a microphone, and cannot gate combat.

## Effects

DustSystem includes 3500/1000/400 instanced shader-driven sand sprites and ForegroundGrit's 20/14/10 near-lens instances in one draw call. Haze adds one fullscreen noise draw, gusts, sun-directed faux shafts and recent-impact lighting. All trajectories execute on the GPU. The same dust shader produces radial hit gusts.

ImpactFlash, Shockwave ground rings, ScorchDecals and ShieldRipple each use a fixed 30-slot instanced pool. SparkPool is one GPU draw with 40/28/20 sparks per slot, ballistic motion and a single ground bounce. BladeAccents adds additive saber capsules, recent-clash glow and at most four pooled transient lights. CameraShake restores its previous cosmetic camera contribution before the original camera-follow callback, then adds decaying trauma and a ≤2° punch. HitStop owns only a VFX clock: two frames on ordinary hits, four on large hits, optional 0.5s VFX slow time on finishing hits. Body tracking, blades and network clocks do not consume that clock.

PostFX uses a high bloom threshold, mild vignette/noise, an impact distortion ring and a normally-zero chromatic offset. Low omits distortion and chromatic aberration. Reduced motion disables shake, hit-stop, distortion and knockout overlays.

## Deliberate approximations / limits

- This live flow is saber combat. There are no active laser-bolt render events to upgrade, so existing blades receive the hot-core/glow layer; no projectiles, hits or shield mechanics were invented.
- ShieldRipple is a cosmetic hex/fresnel guard flash on an existing blocked event, not evidence of a persistent shield or a held-lock game state. Clash glow is brief and event-driven.
- Existing impact positions are already approximate (clash midpoint or defender chest). Incoming blade direction supplies an approximate visual normal. Scorches and radial dust are projected onto the arena's local floor height, not a new raycast/collision result.
- Soft particles fade against arena ground height and distance. They do not sample full scene depth, so arbitrary distant rocks can still intersect particles. This avoids a second scene/depth render pass. Scorches are on the local arena plane, not ship/terrain texture decals.
- The exact original tracked-joint rendering continues during hit-stop/slow motion to avoid hiding live inputs. Only VFX time slows. A knockout does not delay the existing result screen; its separate overlay carries the final flourish.
- Pools, materials, buffers and audio voices are preallocated. The existing upstream flashRef object allocation and existing blade trail allocations were not rewritten.

## Verification / local measurements

`npm test`: 186 passed, one opt-in live-server test skipped. New tests cover clock isolation, pool reuse and deduplication. `npm run build` / typecheck passed. Browser inspected high, low, master-off and synthetic finisher/guard impacts.

Local development Chrome preview, ~1800×986 displayed viewport, DPR capped 1.5: master off 67 calls / 86 FPS; high on 75 calls / 84–87 FPS. A separate low-tier sample read 74 calls / 74 FPS. These are short rolling samples amid development reloads and other tabs, not a controlled benchmark or a device guarantee. Instrumentation counts all render passes by temporarily disabling gl.info.autoReset, then resetting once per displayed frame. No actual multiplayer/device combat test was performed for this visual pass.

`/?dev=arena&vfxStats=1&vfxDemo=1` shows draw/FPS telemetry and clearly labeled synthetic hit/guard/finisher controls. Demo controls affect only this VFX runtime; they never emit game commands or change gameplay. The baseline preview's original synthetic clash still runs. Toggle VFX.enabled in config.ts to compare the original render.

Scenery follow-up: `ArenaAtmosphere` adds a non-colliding wreck, smoke/beacon,
colored ground pools, spotlights and saber point lights (extra duel lights omitted
on low quality). `PilotDetails` attaches helmet frames/badges to existing joints
and plays a reduced-motion-aware first-lock scan. These are per-pilot details,
not a new synchronized character customization system. `VictoryScene` uses the
last presentation pose and a separate camera only after the authoritative result;
result controls appear immediately. No tracked pose means no invented winner pose.
All have individual config switches; haze is rust-red with a lighter center.
