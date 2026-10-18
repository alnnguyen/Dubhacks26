import { useAnchor, type AnchorRegistry } from '../spaceship/anchors';
import { Emblem, HoloButton, HoloPanel, PilotStatusTag, SignalBars } from './primitives';
import type { ConnectionStatus, NearbyPilot } from '../../state/lobbyTypes';

function BlipLabel({ anchors, pilot, selected, onSelect }: { anchors: AnchorRegistry; pilot: NearbyPilot; selected: boolean; onSelect: (id: string) => void }) {
  const ref = useAnchor(anchors, `blip-${pilot.id}`, undefined, { origin: [0.5, 1], offset: [0, -14], clampPad: 8 });
  return (
    <button
      ref={ref}
      type="button"
      className={`sd-anchored sd-blip-label sd-blip-label--${pilot.status}`}
      data-selected={selected}
      onClick={() => onSelect(pilot.id)}
      aria-pressed={selected}
    >
      {pilot.callsign}
      <span>{pilot.distanceM}m</span>
    </button>
  );
}

/** Floating callsigns over each radar blip. Only rendered in the radar view. */
export function BlipLabels({ anchors, pilots, selectedId, onSelect }: { anchors: AnchorRegistry; pilots: NearbyPilot[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <>
      {pilots.map((p) => (
        <BlipLabel key={p.id} anchors={anchors} pilot={p} selected={p.id === selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

export function NearbyPlayersPanel({
  open,
  pilots,
  connection,
  selectedId,
  challengeBusy,
  onSelect,
  onChallenge,
  onClose,
}: {
  open: boolean;
  pilots: NearbyPilot[];
  connection: ConnectionStatus;
  selectedId: string | null;
  /** True while a challenge is already in progress. */
  challengeBusy: boolean;
  onSelect: (id: string) => void;
  onChallenge: (id: string) => void;
  onClose: () => void;
}) {
  const selected = pilots.find((p) => p.id === selectedId) ?? null;
  const canChallenge = !!selected && selected.status === 'available' && !challengeBusy;
  return (
    <HoloPanel
      open={open}
      title="Nearby pilots"
      eyebrow={`Proximity radar // ${pilots.length} contact${pilots.length === 1 ? '' : 's'}`}
      side="right"
      onClose={onClose}
      footer={
        <HoloButton variant="primary" size="lg" data-ui-sound="commit" disabled={!canChallenge} onClick={() => selected && onChallenge(selected.id)} className="sd-btn--block">
          {selected ? (selected.status === 'available' ? `Challenge ${selected.callsign}` : `${selected.callsign} is ${selected.status === 'in-duel' ? 'in a duel' : 'away'}`) : 'Select a pilot'}
        </HoloButton>
      }
    >
      {connection !== 'online' ? (
        <p className="sd-empty">{connection === 'connecting' ? 'Scanning for nearby pilots…' : 'Link offline. Reconnect in Systems to resume discovery.'}</p>
      ) : pilots.length === 0 ? (
        <p className="sd-empty">No pilots in range.</p>
      ) : (
        <ul className="sd-pilot-list" role="listbox" aria-label="Nearby pilots">
          {pilots.map((p) => {
            const isSel = p.id === selectedId;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  className="sd-pilot"
                  data-selected={isSel}
                  data-status={p.status}
                  onClick={() => onSelect(p.id)}
                  {...(isSel ? { 'data-autofocus': true } : {})}
                >
                  <Emblem callsign={p.callsign} size={38} tone={p.status === 'in-duel' ? 'orange' : 'cyan'} />
                  <span className="sd-pilot__main">
                    <span className="sd-pilot__name">{p.callsign}</span>
                    <span className="sd-pilot__meta">
                      {p.rank} · {p.record.wins}W {p.record.losses}L
                    </span>
                  </span>
                  <span className="sd-pilot__side">
                    <PilotStatusTag status={p.status} />
                    <span className="sd-pilot__dist">
                      <SignalBars value={p.signal} /> {p.distanceM} m
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </HoloPanel>
  );
}
