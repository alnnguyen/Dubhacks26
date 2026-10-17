import { useEffect, useId, useRef } from 'react';
import { Emblem, HoloButton, useLatest, usePresence } from './primitives';
import type { ChallengePhase, PilotProfile } from '../../state/lobbyTypes';

type ActivePhase = Exclude<ChallengePhase, { kind: 'idle' } | { kind: 'launching' }>;

export interface ChallengeModalProps {
  phase: ChallengePhase;
  self: PilotProfile;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onDismiss: () => void;
  onLaunch: () => void;
}

const COPY: Record<ActivePhase['kind'], { eyebrow: string; title: string }> = {
  incoming: { eyebrow: 'Incoming transmission', title: 'Duel challenge' },
  outgoing: { eyebrow: 'Challenge transmitted', title: 'Awaiting response' },
  declined: { eyebrow: 'Transmission closed', title: 'Challenge declined' },
  accepted: { eyebrow: 'Opponent accepted', title: 'Duel confirmed' },
  ready: { eyebrow: 'Battle setup ready', title: 'Duel ready' },
};

/**
 * The full challenge flow in one projected modal. Incoming challenges arrive as
 * an alert banner at the top; every other phase is centered.
 */
export function ChallengeModal({ phase, self, onAccept, onDecline, onCancel, onDismiss, onLaunch }: ChallengeModalProps) {
  const active = phase.kind !== 'idle' && phase.kind !== 'launching' ? (phase as ActivePhase) : null;
  const shown = useLatest(active);
  const { mounted, state } = usePresence(!!active, 360);
  const titleId = useId();
  const descId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }), 80);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (active.kind === 'incoming') onDecline();
      else if (active.kind === 'outgoing') onCancel();
      else if (active.kind === 'declined' || active.kind === 'ready') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, onDecline, onCancel, onDismiss]);

  if (!mounted || !shown) return null;
  const { kind, opponent } = shown;
  const copy = COPY[kind];
  const tone = kind === 'incoming' ? 'alert' : kind === 'declined' ? 'muted' : kind === 'ready' || kind === 'accepted' ? 'go' : 'info';

  return (
    <div className={`sd-challenge sd-challenge--${kind === 'incoming' ? 'banner' : 'center'}`} data-state={state} data-tone={tone}>
      {kind !== 'incoming' && <div className="sd-challenge__scrim" aria-hidden />}
      <div ref={ref} className="sd-challenge__card" role={kind === 'incoming' ? 'alertdialog' : 'dialog'} aria-modal={kind !== 'incoming'} aria-labelledby={titleId} aria-describedby={descId} data-hud-panel>
        <p className="sd-eyebrow">{copy.eyebrow}</p>
        <h2 id={titleId} className="sd-challenge__title">
          {copy.title}
        </h2>

        {kind === 'ready' || kind === 'accepted' ? (
          <div className="sd-versus">
            <div>
              <Emblem callsign={self.callsign} size={56} />
              <span>{self.callsign}</span>
            </div>
            <span className="sd-versus__vs" aria-hidden>
              VS
            </span>
            <div>
              <Emblem callsign={opponent.callsign} size={56} tone="orange" />
              <span>{opponent.callsign}</span>
            </div>
          </div>
        ) : (
          <div className="sd-challenge__who">
            <span className="sd-pulse" data-active={kind === 'outgoing' || kind === 'incoming'} aria-hidden>
              <Emblem callsign={opponent.callsign} size={52} tone={kind === 'incoming' ? 'orange' : 'cyan'} />
            </span>
            <span>
              <strong>{opponent.callsign}</strong>
              <span className="sd-challenge__meta">
                {opponent.rank} · {opponent.record.wins}W {opponent.record.losses}L · {opponent.distanceM} m
              </span>
            </span>
          </div>
        )}

        <p id={descId} className="sd-challenge__desc" aria-live="polite">
          {kind === 'incoming' && `${opponent.callsign} challenges you to a duel.`}
          {kind === 'outgoing' && `Waiting for ${opponent.callsign} to respond…`}
          {kind === 'declined' && `${opponent.callsign} declined the challenge.`}
          {kind === 'accepted' && 'Synchronizing battle setup…'}
          {kind === 'ready' && 'Both pilots locked in. Engage to expand the domain.'}
        </p>

        {(kind === 'outgoing' || kind === 'accepted') && (
          <div className="sd-progress" data-kind={kind} aria-hidden>
            <span />
          </div>
        )}

        <div className="sd-challenge__actions">
          {kind === 'incoming' && (
            <>
              <HoloButton variant="danger" onClick={onDecline}>
                Decline
              </HoloButton>
              <HoloButton variant="accent" onClick={onAccept} data-autofocus>
                Accept
              </HoloButton>
            </>
          )}
          {kind === 'outgoing' && (
            <HoloButton variant="ghost" onClick={onCancel} data-autofocus>
              Cancel challenge
            </HoloButton>
          )}
          {kind === 'declined' && (
            <HoloButton variant="ghost" onClick={onDismiss} data-autofocus>
              Back to bridge
            </HoloButton>
          )}
          {kind === 'ready' && (
            <>
              <HoloButton variant="ghost" onClick={onDismiss}>
                Stand down
              </HoloButton>
              <HoloButton variant="primary" size="lg" onClick={onLaunch} data-autofocus>
                Engage
              </HoloButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
