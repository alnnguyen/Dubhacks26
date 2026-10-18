import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AvatarAction } from '../types/avatar';
import type { AstronautRig } from '../utils/astronautModel';
import { authorSaberClip, SABER_KEYS } from '../utils/saberClips';

const FADE = 0.18;

interface ActionSpec {
  clip: THREE.AnimationClip;
  /** One-shot actions return to idle when they end (unless `hold`). */
  once?: boolean;
  /** Freeze on the last frame instead of returning to idle. */
  hold?: boolean;
  timeScale?: number;
}

function sourceClip(clips: THREE.AnimationClip[], name: string) {
  const clip = clips.find((c) => c.name === name || c.name.endsWith(`|${name}`));
  if (!clip) throw new Error(`Astronaut animation "${name}" is missing.`);
  return clip;
}

/** Saber pumps in time with the source "Yes" celebration (keys are authored on a 0–0.8 s loop). */
function victoryClip(rig: AstronautRig, base: THREE.AnimationClip) {
  const k = base.duration / 0.8;
  const keys = SABER_KEYS.victory.map((key) => ({ ...key, t: key.t * k }));
  return authorSaberClip(rig, 'saber-victory', base, keys);
}

/** Maps every AvatarAction to a clip: source animations where they fit, authored saber clips where none exists. */
function buildActions(rig: AstronautRig, clips: THREE.AnimationClip[]): Record<AvatarAction, ActionSpec> {
  const idleBase = sourceClip(clips, 'Idle_Gun');
  const ready = authorSaberClip(rig, 'saber-idle', idleBase, SABER_KEYS.ready);
  // Block is a held guard over a slight crouch: the first part of the source Duck.
  const duck = THREE.AnimationUtils.subclip(sourceClip(clips, 'Duck'), 'duck-in', 0, 12, 30);
  const block = authorSaberClip(rig, 'saber-block', duck, SABER_KEYS.block);
  return {
    idle: { clip: ready },
    attack: { clip: authorSaberClip(rig, 'saber-attack', idleBase, SABER_KEYS.attack, 0.8), once: true, timeScale: 1.1 },
    block: { clip: block, once: true, hold: true },
    hit: { clip: sourceClip(clips, 'HitReact'), once: true },
    victory: { clip: victoryClip(rig, sourceClip(clips, 'Yes')) },
    defeat: { clip: sourceClip(clips, 'Death'), once: true, hold: true },
  };
}

/**
 * Drives the rig from a declarative `action`. Changing `action` (or `trigger`, to
 * replay the same one) crossfades; one-shots fall back to idle and report completion.
 */
export function useAvatarAnimations(
  rig: AstronautRig,
  clips: THREE.AnimationClip[],
  action: AvatarAction,
  trigger: number,
  onComplete?: (action: AvatarAction) => void,
  /** Freeze `action` at this time in seconds (static poses for thumbnails/tests). */
  poseTime?: number,
) {
  const mixer = useMemo(() => new THREE.AnimationMixer(rig.root), [rig]);
  const specs = useMemo(() => buildActions(rig, clips), [rig, clips]);
  const actions = useMemo(() => {
    const out = {} as Record<AvatarAction, THREE.AnimationAction>;
    for (const [name, spec] of Object.entries(specs) as [AvatarAction, ActionSpec][]) {
      const a = mixer.clipAction(spec.clip);
      a.setLoop(spec.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = !!spec.hold;
      a.timeScale = spec.timeScale ?? 1;
      out[name] = a;
    }
    return out;
  }, [mixer, specs]);
  const current = useRef<THREE.AnimationAction | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const play = (next: THREE.AnimationAction) => {
    const prev = current.current;
    next.reset().setEffectiveWeight(1).play();
    if (prev && prev !== next) next.crossFadeFrom(prev, FADE, false);
    current.current = next;
  };

  useEffect(() => {
    if (poseTime !== undefined) {
      mixer.stopAllAction();
      const a = actions[action].reset().play();
      a.paused = true;
      a.time = poseTime;
      current.current = a;
      mixer.update(0);
      return;
    }
    play(actions[action]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, actions, trigger, poseTime]);

  useEffect(() => {
    const onFinished = (event: { action: THREE.AnimationAction }) => {
      const finished = (Object.entries(actions) as [AvatarAction, THREE.AnimationAction][]).find(([, a]) => a === event.action)?.[0];
      if (!finished) return;
      if (!specs[finished].hold && current.current === event.action) play(actions.idle);
      completeRef.current?.(finished);
    };
    mixer.addEventListener('finished', onFinished as never);
    return () => mixer.removeEventListener('finished', onFinished as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, mixer, specs]);

  useEffect(
    () => () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(rig.root);
    },
    [mixer, rig],
  );

  useFrame((_, dt) => mixer.update(Math.min(dt, 0.1)));
  return mixer;
}
