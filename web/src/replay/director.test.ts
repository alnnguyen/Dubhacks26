import { describe, expect, it } from 'vitest';
import type { PlayerView } from '../../../server/src/contracts';
import { coversInterval, createArenaRecording, finishingImpact, recordedFrameAt } from './arenaRecording';
import { buildReel, cinematicCamera, reelCursor, reelDuration, shotOffset } from './director';
import { syntheticFrame, syntheticMoments, syntheticRecording } from './syntheticArena';

const finished = (winner: 1 | 2, reason: 'knockout' | 'forfeit' = 'knockout') => ({ phase: 'finished', result: {winner,reason},
  you: {slot:1,health:winner===1?80:0}, rival:{slot:2,health:winner===2?80:0} }) as PlayerView;

describe('arena replay capture', () => {
  it('starts on the webcam epoch, clones frames, ignores duplicates and captures no motion before opt-in', () => {
    const capture = createArenaRecording(), frame = syntheticFrame(0);
    capture.frame(frame, 1000); expect(capture.snapshot()).toBeNull();
    capture.begin(1100); frame.players[0].joints![0][0] = 999;
    capture.frame(syntheticFrame(.1),1200); capture.frame(syntheticFrame(.1),1201);
    const saved = capture.snapshot()!;
    expect(saved.frames.map(f=>f.at)).toEqual([0,.1]);
    expect(saved.frames[0].frame.players[0].joints![0][0]).not.toBe(999);
    expect(recordedFrameAt(saved,.05)?.serverMs).toBeCloseTo(50);
    capture.pause(); capture.frame(syntheticFrame(.2),1300);
    expect(capture.snapshot()!.frames).toHaveLength(2);
    capture.discard(); expect(capture.snapshot()).toBeNull();
  });
  it('bounds long matches while retaining the opening and the knockout after webcam recording has ended', () => {
    const capture = createArenaRecording(); capture.begin(0);
    for(let i=0;i<=5400;i++) capture.frame(syntheticFrame(i/30),i/30*1000);
    capture.impact({attackerSlot:1,outcome:'hit',damage:20},180_020);
    capture.finish(finished(1),180_021);
    capture.frame(syntheticFrame(180.04),180_040);
    const saved = capture.snapshot()!;
    expect(saved.frames.length).toBeLessThanOrEqual(1900);
    expect(saved.frames[0].at).toBe(0);
    expect(saved.frames.at(-1)!.at).toBeCloseTo(180.04);
    expect(coversInterval(saved,1,4)).toBe(true);
    expect(coversInterval(saved,44,170)).toBe(false);
    expect(recordedFrameAt(saved,100)).toBeNull();
    const reel = buildReel(saved,[{start:1,end:4,caption:'Model observation'}]);
    expect(reel.at(-1)?.finisher).toBe(true);
    expect(reel.at(-1)?.impact?.at).toBeCloseTo(180.02);
    expect(reel.at(-1)?.end).toBeGreaterThan(45);
  });
  it('does not turn a forfeit, missing terminal event or a prior hit into a kill shot', () => {
    const sample = syntheticRecording();
    expect(finishingImpact({...sample,result:{winner:1,reason:'forfeit'}})).toBeNull();
    expect(finishingImpact({...sample,impacts:sample.impacts.slice(0,-1)})).toBeNull();
    expect(finishingImpact({...sample,defeatedSlot:null})).toBeNull();
    expect(finishingImpact({...sample,result:{winner:2,reason:'knockout'}})).toBeNull();
  });
  it('keeps the actual projectile finishing event rather than a nearby earlier saber hit', () => {
    const capture=createArenaRecording(); capture.begin(0);
    for(let i=0;i<=90;i++) capture.frame(syntheticFrame(i/30),i/30*1000);
    capture.impact({attackerSlot:1,outcome:'hit',damage:20},2900,'saber');
    capture.impact({attackerSlot:1,outcome:'hit',damage:20},2950,'gun');
    capture.finish(finished(1),2951);
    const saved=capture.snapshot()!;
    expect(saved.impacts).toHaveLength(2);
    expect(finishingImpact(saved)?.weapon).toBe('gun');
    expect(buildReel(saved,[]).at(-1)?.caption).toBe('The finishing shot');
  });
});

describe('cinematic director', () => {
  it('replays sideways movement through the recorded joints and board cells', () => {
    const sample=syntheticRecording();
    const before=recordedFrameAt(sample,2)!.players[0], after=recordedFrameAt(sample,6)!.players[0];
    expect(after.joints![23][0]-before.joints![23][0]).toBeCloseTo(.65);
    expect(before.cell.q).toBe(0); expect(after.cell.q).toBe(1);
    expect(recordedFrameAt(sample,9)!.players[0].cell.q).toBe(0);
  });
  it('keeps model-selected scenes and forces the real finishing blow to be the last unique highlight', () => {
    const sample = syntheticRecording();
    const reel = buildReel(sample,[...syntheticMoments,{start:9,end:10.6,caption:'AI saw the final swing'}]);
    expect(reel.map(s=>s.source)).toEqual(['perceptron','perceptron','server']);
    expect(reel.at(-1)?.finisher).toBe(true);
    expect(reel.filter(s=>s.finisher)).toHaveLength(1);
    expect(reel.slice(0,-1).every(s=>s.end<=reel.at(-1)!.start)).toBe(true);
    const final = reelCursor(reel,reelDuration(reel))!;
    expect(final.index).toBe(reel.length-1); expect(final.done).toBe(true); expect(final.hold).toBe(true);
    expect(final.seconds).toBe(reel.at(-1)!.end);
  });
  it('labels server fallback selections without pretending the model selected them', () => {
    const reel=buildReel(syntheticRecording(),[]);
    expect(reel.length).toBeGreaterThan(1);
    expect(reel.every(s=>s.source==='server')).toBe(true);
    expect(reel.at(-1)?.finisher).toBe(true);
  });
  it('ramps down around a real hit, holds on impact, supports seeking and honors reduce motion', () => {
    const sample=syntheticRecording(), reel=buildReel(sample,syntheticMoments);
    const start=shotOffset(reel,2);
    let slow=false,hold=false;
    for(let t=start;t<reelDuration(reel);t+=.02){const c=reelCursor(reel,t)!;slow ||= c.rate>0&&c.rate<.3;hold ||= c.hold;}
    expect(slow).toBe(true); expect(hold).toBe(true);
    expect(reelCursor(reel,start)!.index).toBe(2);
    expect(reelDuration(reel,true)).toBeCloseTo(reel.reduce((n,s)=>n+s.end-s.start,0));
    for(let t=0;t<reelDuration(reel,true);t+=.2){const c=reelCursor(reel,t,true)!;expect(c.rate).toBe(1);expect(c.hold).toBe(false);}
  });
  it('produces distinct finite camera angles without relying on a live body or phone', () => {
    const sample=syntheticRecording(), shots=buildReel(sample,syntheticMoments), cursor=reelCursor(shots,1)!;
    const poses = (['orbit','low','overhead'] as const).map(angle=>cinematicCamera(sample.frames[0].frame,shots[0],cursor,1,false,angle));
    for(const p of poses){expect([...p.position,...p.target,p.fov].every(Number.isFinite)).toBe(true);expect(p.position[1]).toBeGreaterThan(.7);}
    expect(poses[2].position[1]).toBeGreaterThan(poses[0].position[1]);
    expect(poses[0].position).not.toEqual(poses[1].position);
    const steadyA=cinematicCamera(sample.frames[0].frame,shots[0],cursor,1,true);
    const steadyB=cinematicCamera(sample.frames[0].frame,shots[0],{...cursor,progress:.9},1,true);
    expect(steadyA).toEqual(steadyB);
  });
});
