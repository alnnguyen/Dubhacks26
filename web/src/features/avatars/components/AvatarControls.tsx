import type { ReactNode } from 'react';
import {
  ACCENT_COLORS,
  ACCESSORIES,
  SABER_COLORS,
  SUIT_COLORS,
  type AccessoryId,
  type AvatarConfig,
} from '../types/avatar';
import { ACCENT_PALETTES, SABER_PALETTES, SUIT_PALETTES } from '../utils/palette';

export const CREATOR_TABS = ['face', 'suit', 'helmet', 'saber', 'extras'] as const;
export type CreatorTab = (typeof CREATOR_TABS)[number];

const TAB_LABELS: Record<CreatorTab, string> = { face: 'Face', suit: 'Suit', helmet: 'Helmet', saber: 'Saber', extras: 'Extras' };

const ACCESSORY_INFO: Record<AccessoryId, { label: string; hint: string }> = {
  antenna: { label: 'Antenna', hint: 'Glowing comm antenna on the helmet' },
  cape: { label: 'Cape', hint: 'Flowing cape in your suit shade' },
  patch: { label: 'Mission patch', hint: 'Jedi Space Duels patch on the left shoulder' },
  jetpack: { label: 'Jetpack', hint: 'Twin-thruster pack instead of life support' },
};

export function CreatorTabs({ tab, onTab }: { tab: CreatorTab; onTab: (tab: CreatorTab) => void }) {
  return (
    <div className="av-tabs" role="tablist" aria-label="Customize">
      {CREATOR_TABS.map((t) => (
        <button key={t} type="button" role="tab" id={`av-tab-${t}`} aria-selected={tab === t} aria-controls={`av-panel-${t}`} className="av-tab" onClick={() => onTab(t)}>
          {TAB_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

function Swatches<T extends string>({
  label,
  options,
  value,
  color,
  name,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  color: (id: T) => string;
  name: (id: T) => string;
  onChange: (id: T) => void;
}) {
  return (
    <fieldset className="av-field">
      <legend>{label}</legend>
      <div className="av-swatches" role="radiogroup" aria-label={label}>
        {options.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            className="av-swatch"
            style={{ ['--swatch' as string]: color(id) }}
            onClick={() => onChange(id)}
            title={name(id)}
          >
            <span className="av-swatch__chip" aria-hidden />
            <span className="av-swatch__name">{name(id)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="av-toggle">
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export interface AvatarControlsProps {
  tab: CreatorTab;
  config: AvatarConfig;
  onChange: (patch: Partial<AvatarConfig>) => void;
  saberIgnited: boolean;
  onSaberIgnited: (v: boolean) => void;
  /** Face tab content is owned by the creator (it needs the camera/editor flow). */
  faceSection: ReactNode;
}

export function AvatarControls({ tab, config, onChange, saberIgnited, onSaberIgnited, faceSection }: AvatarControlsProps) {
  const toggleAccessory = (id: AccessoryId, on: boolean) =>
    onChange({ accessories: on ? [...config.accessories, id] : config.accessories.filter((a) => a !== id) });

  return (
    <div className="av-panel" role="tabpanel" id={`av-panel-${tab}`} aria-labelledby={`av-tab-${tab}`}>
      {tab === 'face' && faceSection}
      {tab === 'suit' && (
        <Swatches
          label="Spacesuit color"
          options={SUIT_COLORS}
          value={config.suit}
          color={(id) => SUIT_PALETTES[id].main}
          name={(id) => SUIT_PALETTES[id].label}
          onChange={(suit) => onChange({ suit })}
        />
      )}
      {tab === 'helmet' && (
        <>
          <Swatches
            label="Accent lights"
            options={ACCENT_COLORS}
            value={config.accent}
            color={(id) => ACCENT_PALETTES[id].color}
            name={(id) => ACCENT_PALETTES[id].label}
            onChange={(accent) => onChange({ accent })}
          />
          <Toggle label={ACCESSORY_INFO.antenna.label} hint={ACCESSORY_INFO.antenna.hint} checked={config.accessories.includes('antenna')} onChange={(v) => toggleAccessory('antenna', v)} />
        </>
      )}
      {tab === 'saber' && (
        <>
          <Swatches
            label="Blade color"
            options={SABER_COLORS}
            value={config.saber}
            color={(id) => SABER_PALETTES[id].glow}
            name={(id) => SABER_PALETTES[id].label}
            onChange={(saber) => onChange({ saber })}
          />
          <Toggle label="Blade ignited" hint="Preview only" checked={saberIgnited} onChange={onSaberIgnited} />
        </>
      )}
      {tab === 'extras' && (
        <fieldset className="av-field">
          <legend>Accessories</legend>
          {ACCESSORIES.filter((id) => id !== 'antenna').map((id) => (
            <Toggle key={id} label={ACCESSORY_INFO[id].label} hint={ACCESSORY_INFO[id].hint} checked={config.accessories.includes(id)} onChange={(v) => toggleAccessory(id, v)} />
          ))}
        </fieldset>
      )}
    </div>
  );
}
