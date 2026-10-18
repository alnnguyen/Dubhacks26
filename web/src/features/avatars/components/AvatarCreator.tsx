import { useEffect, useRef, useState } from 'react';
import { useAvatarCustomization } from '../hooks/useAvatarCustomization';
import { AVATAR_ACTIONS, DEFAULT_AVATAR, NAME_MAX_LENGTH, type AvatarAction } from '../types/avatar';
import { sanitizeName } from '../utils/avatarConfig';
import { AvatarControls, CreatorTabs, type CreatorTab } from './AvatarControls';
import { AvatarPreview } from './AvatarPreview';
import { PhotoFaceEditor } from './PhotoFace';
import '../avatars.css';

const ACTION_LABELS: Record<AvatarAction, string> = {
  idle: 'Idle',
  attack: 'Attack',
  block: 'Block',
  hit: 'Hit',
  victory: 'Victory',
  defeat: 'Defeat',
};

export interface AvatarCreatorProps {
  /** Onboarding mode: the creator is a step. Shows "Save & continue" and a Skip option. */
  onContinue?: () => void;
  /** Onboarding mode: go back to the previous step instead of linking to the bridge. */
  onBack?: () => void;
  /** Name a fresh avatar after the pilot (only while it still has the default name). */
  defaultName?: string;
}

/** Astronaut creator: standalone at /avatar-creator, or a step in onboarding. Everything is saved on this device only. */
export function AvatarCreator({ onContinue, onBack, defaultName }: AvatarCreatorProps = {}) {
  const avatar = useAvatarCustomization();
  const { config } = avatar;
  const embedded = Boolean(onContinue);
  const [tab, setTab] = useState<CreatorTab>('face');
  const [action, setAction] = useState<AvatarAction>('idle');
  const [trigger, setTrigger] = useState(0);
  const [saberIgnited, setSaberIgnited] = useState(true);
  const [editing, setEditing] = useState<'camera' | File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultName && config.name === DEFAULT_AVATAR.name) avatar.update({ name: sanitizeName(defaultName) });
    // Only on mount: later name edits are the pilot's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = (next: AvatarAction) => {
    setAction(next);
    setTrigger((t) => t + 1);
  };

  const faceSection = editing ? (
    <PhotoFaceEditor
      key={editing === 'camera' ? 'camera' : `${editing.name}-${editing.lastModified}`}
      start={editing}
      onPreview={avatar.previewFace}
      onConfirm={async (face, png) => {
        await avatar.commitFace(face, png);
        setEditing(null);
      }}
      onCancel={() => setEditing(null)}
    />
  ) : (
    <div className="face-summary">
      <div className="face-summary__thumb" aria-hidden>
        {avatar.faceUrl ? <img src={avatar.faceUrl} alt="" /> : <span>No photo</span>}
      </div>
      <div className="face-summary__body">
        <p>{avatar.faceUrl ? 'Your face is inside the helmet.' : 'Put your real face inside the helmet.'}</p>
        {avatar.faceMissing && <p className="face-summary__warn">Your saved photo was not found on this device. Add it again.</p>}
        <div className="av-row">
          <button type="button" className="av-btn av-btn--primary" onClick={() => setEditing('camera')}>
            Take selfie
          </button>
          <button type="button" className="av-btn" onClick={() => fileInput.current?.click()}>
            Upload photo
          </button>
          {avatar.faceUrl && (
            <button type="button" className="av-btn av-btn--ghost" onClick={() => void avatar.removeFace()}>
              Remove
            </button>
          )}
        </div>
        <p className="face-summary__privacy">Photos are processed on this device. Your cropped avatar face is shared with your opponent during live matches.</p>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setEditing(file);
          e.target.value = '';
        }}
      />
    </div>
  );

  const saveLabel = avatar.saveState === 'saved' && !avatar.dirty ? 'Saved' : avatar.saveState === 'error' ? 'Retry save' : 'Save fighter';

  return (
    <div className="av-root">
      <header className="av-header">
        <div>
          <p className="av-eyebrow">{embedded ? 'Pilot uplink // Fighter lab' : 'Jedi Space Duels // Fighter lab'}</p>
          <h1>{embedded ? 'Create your astronaut' : 'Astronaut creator'}</h1>
        </div>
        {onBack ? (
          <button type="button" className="av-btn av-btn--ghost av-header__back" onClick={onBack}>
            Back
          </button>
        ) : (
          <a className="av-btn av-btn--ghost av-header__back" href="/">
            Back to bridge
          </a>
        )}
      </header>

      <main className="av-layout">
        <section className="av-stage" aria-label="Astronaut preview">
          <AvatarPreview
            look={config}
            faceTexture={avatar.faceTexture}
            action={action}
            actionTrigger={trigger}
            saberIgnited={saberIgnited}
            displayName={config.name}
          />
          <p className="av-stage__hint" aria-hidden>
            Drag to rotate
          </p>
          <div className="av-actions" role="group" aria-label="Preview animations">
            {AVATAR_ACTIONS.map((a) => (
              <button key={a} type="button" className="av-chip" aria-pressed={action === a} onClick={() => play(a)}>
                {ACTION_LABELS[a]}
              </button>
            ))}
          </div>
        </section>

        <section className="av-side" aria-label="Customize your astronaut">
          <label className="av-name">
            <span>Fighter name</span>
            <input
              value={config.name}
              maxLength={NAME_MAX_LENGTH}
              onChange={(e) => avatar.update({ name: e.target.value })}
              onBlur={(e) => avatar.update({ name: sanitizeName(e.target.value) })}
              autoComplete="nickname"
              spellCheck={false}
            />
          </label>
          <CreatorTabs tab={tab} onTab={setTab} />
          <AvatarControls
            tab={tab}
            config={config}
            onChange={avatar.update}
            saberIgnited={saberIgnited}
            onSaberIgnited={setSaberIgnited}
            faceSection={faceSection}
          />
          <div className="av-save">
            <button
              type="button"
              className="av-btn av-btn--primary av-btn--block"
              onClick={() => {
                const saved = avatar.save();
                if (saved && embedded) onContinue?.();
              }}
              disabled={avatar.saveState === 'saving'}
            >
              {embedded ? 'Save & continue' : saveLabel}
            </button>
            {embedded && (
              <button type="button" className="av-btn av-btn--ghost av-btn--block" onClick={onContinue}>
                Skip for now
              </button>
            )}
            <p className="av-save__note" role="status">
              {avatar.saveState === 'error'
                ? 'Could not save: browser storage is blocked.'
                : avatar.dirty
                  ? 'Unsaved changes'
                  : embedded
                    ? 'You can change this later at /avatar-creator.'
                    : 'Saved on this device. Reopen any time at /avatar-creator.'}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
