import { useRef, useState } from 'react';
import { useAvatarCustomization } from '../hooks/useAvatarCustomization';
import { AVATAR_ACTIONS, NAME_MAX_LENGTH, type AvatarAction } from '../types/avatar';
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

/** Standalone astronaut creator at /avatar-creator. Everything is saved on this device only. */
export function AvatarCreator() {
  const avatar = useAvatarCustomization();
  const { config } = avatar;
  const [tab, setTab] = useState<CreatorTab>('face');
  const [action, setAction] = useState<AvatarAction>('idle');
  const [trigger, setTrigger] = useState(0);
  const [saberIgnited, setSaberIgnited] = useState(true);
  const [editing, setEditing] = useState<'camera' | File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

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
        <p className="face-summary__privacy">Photos are processed and stored only on this device.</p>
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
          <p className="av-eyebrow">Jedi Space Duels // Fighter lab</p>
          <h1>Astronaut creator</h1>
        </div>
        <a className="av-btn av-btn--ghost av-header__back" href="/">
          Back to bridge
        </a>
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
            <button type="button" className="av-btn av-btn--primary av-btn--block" onClick={avatar.save} disabled={avatar.saveState === 'saving'}>
              {saveLabel}
            </button>
            <p className="av-save__note" role="status">
              {avatar.saveState === 'error'
                ? 'Could not save: browser storage is blocked.'
                : avatar.dirty
                  ? 'Unsaved changes'
                  : 'Saved on this device. Reopen any time at /avatar-creator.'}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
