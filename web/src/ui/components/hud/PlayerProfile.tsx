import { ConnectionBadge, Emblem, HoloPanel } from './primitives';
import type { ConnectionStatus, PilotProfile } from '../../state/lobbyTypes';

/** Compact identity plate, docked at the top edge. */
export function ProfileChip({
  self,
  connection,
  hidden,
  onOpen,
}: {
  self: PilotProfile;
  connection: ConnectionStatus;
  hidden: boolean;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="sd-dock sd-dock--top sd-chip" data-ui-sound="commit" data-hidden={hidden} onClick={onOpen} aria-label={`Pilot profile: ${self.callsign}, ${connection}`}>
      <Emblem callsign={self.callsign} size={34} tone={self.accent === 'amber' ? 'amber' : self.accent === 'violet' ? 'violet' : 'cyan'} />
      <span className="sd-chip__text">
        <span className="sd-chip__name">{self.callsign}</span>
        <span className="sd-chip__meta">
          {self.shipName ? `${self.shipName} · ` : ''}
          {self.rank} · <ConnectionBadge status={connection} />
        </span>
      </span>
    </button>
  );
}

export function ProfilePanel({
  open,
  self,
  connection,
  discoveryLabel,
  onClose,
  onOpenSettings,
}: {
  open: boolean;
  self: PilotProfile;
  connection: ConnectionStatus;
  discoveryLabel: string;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const total = self.record.wins + self.record.losses;
  const rate = total ? Math.round((self.record.wins / total) * 100) : 0;
  return (
    <HoloPanel
      open={open}
      title={self.callsign}
      eyebrow="Pilot ID // Commander display"
      side="right"
      onClose={onClose}
      footer={
        <button type="button" className="sd-btn sd-btn--ghost sd-btn--md" onClick={onOpenSettings}>
          <span className="sd-btn__label">Edit callsign</span>
        </button>
      }
    >
      <div className="sd-profile">
        <Emblem callsign={self.callsign} size={72} tone={self.accent === 'amber' ? 'amber' : self.accent === 'violet' ? 'violet' : 'cyan'} />
        <dl className="sd-stats">
          {self.shipName ? (
            <div>
              <dt>Ship</dt>
              <dd>{self.shipName}</dd>
            </div>
          ) : null}
          <div>
            <dt>Rank</dt>
            <dd>{self.rank}</dd>
          </div>
          <div>
            <dt>Record</dt>
            <dd>
              {self.record.wins}W · {self.record.losses}L
            </dd>
          </div>
          <div>
            <dt>Win rate</dt>
            <dd>{rate}%</dd>
          </div>
        </dl>
      </div>
      <div className="sd-meter" aria-hidden>
        <span style={{ width: `${rate}%` }} />
      </div>
      <dl className="sd-kv">
        <div>
          <dt>Link</dt>
          <dd>
            <ConnectionBadge status={connection} />
          </dd>
        </div>
        <div>
          <dt>Discovery</dt>
          <dd>{discoveryLabel}</dd>
        </div>
      </dl>
    </HoloPanel>
  );
}
