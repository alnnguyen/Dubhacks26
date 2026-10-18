import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { SoundShell } from "./audio/SoundShell";
import "./ui/styles/brand.css";
import "./ui/styles/button-feedback.css";

const search = new URLSearchParams(window.location.search);
// Mars arena scene only (no camera/networking): /?arena=mars
const marsPreview = search.get("arena") === "mars";
// Phone lightsaber controller, opened from the laptop's pair code: /?saber=CODE
const saberCode = search.get("saber");
// The saber arena with synthetic fighters, no camera/phone/server: /?dev=arena
const devArena = search.get("dev") === "arena";
// Cinematic director with labeled synthetic frames/events; never a provider proof.
const devReplay = search.get("dev") === "replay";

const initiationPreview = search.get("dev") === "initiation";
const explore = search.has("explore");
const soundCheck = search.get("audio") === "check";
const marsJourney = search.get("journey") === "mars";
const neptunePreview =
  search.get("arena") === "neptune" || search.get("journey") === "neptune";
const hudPreview = search.get("dev") === "hud";
const Screen = hudPreview
  ? lazy(async () => {
      const m = await import("./arena3d/HudPreview");
      return { default: m.HudPreview };
    })
  : marsJourney
    ? lazy(async () => {
        const m = await import("./arena/mars/MarsJourneyPreview");
        return { default: m.MarsJourneyPreview };
      })
  : neptunePreview
    ? lazy(async () => {
        const m = await import("./arena/neptune/NeptunePreview");
        return { default: m.NeptunePreview };
      })
    : soundCheck
      ? lazy(async () => {
          const m = await import("./audio/SoundCheck");
          return { default: m.SoundCheck };
        })
      : devReplay
        ? lazy(async () => {
            const m = await import("./replay/ReplayPreview");
            return { default: m.ReplayPreview };
          })
        : devArena
          ? lazy(async () => {
              const m = await import("./arena3d/ArenaPreview");
              return { default: m.ArenaPreview };
            })
          : saberCode
            ? lazy(async () => {
                const m = await import("./saber/SaberPhone");
                return { default: () => <m.SaberPhone code={saberCode} /> };
              })
            : initiationPreview
              ? lazy(async () => {
                  const m = await import("./arena3d/SaberInitiationPreview");
                  return { default: m.SaberInitiationPreview };
                })
              : explore
                ? lazy(async () => {
                    const m = await import("./ui/screens/ExploreApp");
                    return { default: m.ExploreApp };
                  })
                : marsPreview
                  ? lazy(async () => {
                      const m = await import("./arena/MarsPreview");
                      return { default: m.MarsPreview };
                    })
                  : lazy(async () => {
                      // Onboarding → cockpit; FlightApp (real lobby + duel) is next wiring step.
                      const m = await import("./ui/screens/BridgeApp");
                      return { default: m.BridgeApp };
                    });

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<p>Loading flight systems…</p>}>
      <SoundShell enabled={!saberCode}>
        <Screen />
      </SoundShell>
    </Suspense>
  </StrictMode>,
);
