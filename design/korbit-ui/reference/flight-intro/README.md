# Full-screen onboarding animation prototype

Independent preview of the existing onboarding, with oversized slanted type, blue parallelogram plates, diagonal entrances, laser transitions and the existing Three.js hyperspace finish. Shared repository files are untouched.

To integrate after review, replace only these existing onboarding files with the versions under src/onboarding/: OnboardingFlow.tsx, KeywordBlock.tsx, LaserInput.tsx, onboarding.css. Other copied files are unchanged support files. The existing onComplete(PilotIdentity) callback and identity helpers are retained. The preview's src/main.tsx and index.html are standalone scaffolding, not replacements for the app entry.

Dependencies are the app's existing React, motion, Three.js and React Three Fiber packages. No extra package is needed. The preview uses the app's existing identity storage API on its own origin. Reduced-motion preference skips the flying titles and hyperspace. The welcome screen advances on Begin transmission, so it can be reviewed without a timer. Inputs do not force the phone keyboard open.

Standalone setup: `npm install` then `npm run dev`. Production verification: `npm run build`. The preview was checked at desktop size and 390×844, completing callsign → starship → closing beams → hyperspace → completion with the entered identity preserved. Reduced-motion fallback is implemented but was not manually tested with the OS setting.
