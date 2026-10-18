import { useEffect } from 'react';

export interface Mission {
  /** Changes whenever a new banner should play, even with the same words. */
  id: number;
  eyebrow: string;
  lead: string;
  word: string;
  detail?: string;
  tone?: 'blue' | 'rival';
  /** Show the one-pass laser sweep (confirmed travel only). */
  laser?: boolean;
  /** How long the banner stays before settling away. */
  holdMs: number;
}

/**
 * The handoff's flying title plate: a short italic lead and one keyword on a −12° electric-blue plate.
 * Presentation only — it never gates navigation or combat, ignores pointer input, and settles away by itself.
 */
export function MissionBanner({ mission, onDone }: { mission: Mission | null; onDone: () => void }) {
  useEffect(() => {
    if (!mission) return;
    const id = setTimeout(onDone, mission.holdMs);
    return () => clearTimeout(id);
  }, [mission, onDone]);
  if (!mission) return null;
  // The keyword is sized to its length so it always fits inside the plate (no clipping).
  const chars = Math.max(6, mission.word.length);
  return (
    <div className="gx-banner" data-tone={mission.tone ?? 'blue'} key={mission.id} aria-live="polite" role="status"
      style={{ ['--gx-hold' as string]: `${mission.holdMs}ms` }}>
      {mission.laser && <span className="gx-laser" aria-hidden><i /><i /></span>}
      <p className="gx-eyebrow gx-banner__eyebrow">{mission.eyebrow}</p>
      <p className="gx-banner__title">
        <span className="gx-banner__lead">{mission.lead}</span>
        <span className="gx-banner__flight">
          <span className="gx-plate" style={{ ['--gx-chars' as string]: chars }}><span>{mission.word}</span></span>
        </span>
      </p>
      {mission.detail && <p className="gx-banner__detail">{mission.detail}</p>}
    </div>
  );
}
