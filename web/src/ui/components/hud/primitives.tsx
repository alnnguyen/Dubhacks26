import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { ConnectionStatus, PilotStatus } from '../../state/lobbyTypes';

/** Keeps content mounted while it animates out. Replaces a motion library for our needs. */
export function usePresence(open: boolean, exitMs = 320) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const id = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(id);
  }, [open, exitMs]);
  return { mounted, state: shown ? 'open' : 'closed' } as const;
}

/** Remembers the last non-null value so exit animations can still render content. */
export function useLatest<T>(value: T | null | undefined): T | null {
  const ref = useRef<T | null>(value ?? null);
  if (value != null) ref.current = value;
  return ref.current;
}

type Variant = 'primary' | 'ghost' | 'danger' | 'accent';

export function HoloButton({
  variant = 'ghost',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button type="button" className={`sd-btn sd-btn--${variant} sd-btn--${size} ${className}`} {...rest}>
      <span className="sd-btn__label">{children}</span>
    </button>
  );
}

export interface HoloPanelProps {
  open: boolean;
  title: string;
  eyebrow?: string;
  /** Where the panel projects from. Portrait always uses a bottom sheet. */
  side?: 'left' | 'right';
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** A projected holographic sheet. Bottom sheet in portrait, side panel in landscape. */
export function HoloPanel({ open, title, eyebrow, side = 'right', onClose, children, footer }: HoloPanelProps) {
  const { mounted, state } = usePresence(open);
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const id = setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus], button')?.focus({ preventScroll: true }), 60);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(id);
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return (
    <section ref={ref} className={`sd-panel sd-panel--${side}`} data-state={state} role="dialog" aria-modal="false" aria-labelledby={titleId} data-hud-panel>
      <div className="sd-panel__frame">
        <header className="sd-panel__head">
          <div>
            {eyebrow && <p className="sd-eyebrow">{eyebrow}</p>}
            <h2 id={titleId} className="sd-panel__title">
              {title}
            </h2>
          </div>
          <button type="button" className="sd-icon-btn" onClick={onClose} aria-label={`Close ${title}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="sd-panel__body">{children}</div>
        {footer && <footer className="sd-panel__foot">{footer}</footer>}
      </div>
    </section>
  );
}

const CONNECTION_LABEL: Record<ConnectionStatus, string> = { online: 'Online', connecting: 'Linking', offline: 'Offline' };

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className={`sd-conn sd-conn--${status}`} role="status">
      <span className="sd-conn__dot" aria-hidden />
      {CONNECTION_LABEL[status]}
    </span>
  );
}

const PILOT_LABEL: Record<PilotStatus, string> = { available: 'Available', 'in-duel': 'In duel', away: 'Away' };

export function PilotStatusTag({ status }: { status: PilotStatus }) {
  return <span className={`sd-tag sd-tag--${status}`}>{PILOT_LABEL[status]}</span>;
}

export function SignalBars({ value }: { value: number }) {
  const bars = Math.max(1, Math.round(value * 4));
  return (
    <span className="sd-signal" aria-label={`Signal ${Math.round(value * 100)} percent`} role="img">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={i < bars ? 'is-on' : ''} style={{ height: `${6 + i * 3}px` }} />
      ))}
    </span>
  );
}

export function Emblem({ callsign, size = 44, tone = 'cyan' }: { callsign: string; size?: number; tone?: 'cyan' | 'orange' }) {
  const initials = callsign.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() || '??';
  return (
    <span className={`sd-emblem sd-emblem--${tone}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 48 48" width={size} height={size}>
        <polygon points="24,2 44,13 44,35 24,46 4,35 4,13" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
        <polygon points="24,8 39,16.5 39,31.5 24,40 9,31.5 9,16.5" fill="currentColor" opacity="0.12" />
      </svg>
      <span className="sd-emblem__txt">{initials}</span>
    </span>
  );
}
