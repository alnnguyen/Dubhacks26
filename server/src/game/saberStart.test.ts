import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import type { ArenaFrame, SaberResolved, Vec3 } from "../contracts.js";
import { advanceSaberStart, SABER_COUNTDOWN_MS } from "./saberStart.js";
import { Match } from "./match.js";
import { SABER } from "./rules.js";

test("shared start waits for both pilots, cancels on loss, and opens only at the deadline", () => {
  const idle = { startsAtMs: null, unlocked: false };
  assert.equal(advanceSaberStart(idle, false, 0), idle);
  const start = advanceSaberStart(idle, true, 100);
  assert.equal(start.startsAtMs, 100 + SABER_COUNTDOWN_MS);
  assert.equal(advanceSaberStart(start, true, start.startsAtMs! - 1).unlocked, false);
  const cancelled = advanceSaberStart(start, false, 2000);
  assert.deepEqual(cancelled, idle);
  const restarted = advanceSaberStart(cancelled, true, 5000);
  assert.equal(restarted.startsAtMs, 8000);
  const open = advanceSaberStart(restarted, true, 8000);
  assert.equal(open.unlocked, true);
  assert.equal(advanceSaberStart(open, false, 9000), open, "tracking recovery doesn't replay an opened countdown");
});

let match: Match;
let frames: ArenaFrame[];
let resolved: SaberResolved[];
let seq: number;
const joints = (): Vec3[] => {
  const j: Vec3[] = Array.from({length:33},()=>[0,0,0]);
  j[0]=[0,.75,.1];j[11]=[-.2,.5,0];j[12]=[.2,.5,0];
  j[15]=[-.25,.25,.4];j[16]=[.25,.25,.4];j[23]=[-.12,0,0];j[24]=[.12,0,0];
  return j;
};
function send(slot: 1|2, angle: number | null = null, done = true) {
  match.handleBodyPose(slot,{seq:++seq,tracked:true,joints:joints(),calibrated:true,setup:{step:done?"done":"reach",progress:0}});
  match.setSaberCalibration(slot,{forward:[0,1],hand:"right",mirror:false,done});
  const a=(angle??0)*Math.PI/180;
  match.handleSaberAim(slot,{seq:++seq,tracked:true,top:angle===null?[0,0,-1]:[Math.sin(a),Math.cos(a),0],rate:0});
}
function tick(angle: number | null = null) { send(1,angle);send(2);mock.timers.tick(SABER.tickMs); }
beforeEach(()=>{
  mock.timers.enable({apis:["setTimeout","setInterval","Date"],now:100000});
  frames=[];resolved=[];seq=0;
  match=new Match("countdown","mars",{1:{pilotId:"one",callsign:"ONE"},2:{pilotId:"two",callsign:"TWO"}}, {
    changed:()=>{},saberResolved:e=>resolved.push(e),stepped:()=>{},arenaFrame:f=>frames.push(f),finished:()=>{},
  });
  match.handleCommand(1,{commandId:"ready-one",type:"ready"});
  match.handleCommand(2,{commandId:"ready-two",type:"ready"});
  match.setSaberPaired(1,true);match.setSaberPaired(2,true);
  match.step(1,"forward");match.step(2,"forward");
  mock.timers.tick(SABER.stepMs+SABER.stepCooldownMs);
});
afterEach(()=>{match.dispose();mock.timers.reset();});

test("setup swings cannot hit during 3-2-1, then normal combat opens",()=>{
  tick();
  const deadline=frames.at(-1)!.saberStart!.startsAtMs!;
  assert.ok(deadline>Date.now());
  assert.equal(match.saberCombatReady,false);
  assert.equal(match.step(1,"right"),"match_not_active");
  while(Date.now()+SABER.tickMs<deadline) for(const angle of [60,35,10,-15]) {
    if(Date.now()+SABER.tickMs>=deadline) break;
    tick(angle);
  }
  assert.equal(resolved.length,0);
  assert.deepEqual(match.toSnapshot().players.map(p=>p.health),[100,100]);
  while(!match.saberCombatReady) tick();
  assert.equal(frames.at(-1)!.saberStart!.unlocked,true);
  // Start a fresh, fast slash after the authoritative gate has opened.
  for(const angle of [60,35,10,-15]) tick(angle);
  assert.ok(resolved.some(e=>e.outcome==="hit"));
});

test("a lost phone cancels startup and returning starts a fresh shared countdown",()=>{
  tick();const before=frames.at(-1)!.saberStart!.startsAtMs!;
  match.setSaberPaired(2,false);send(1);mock.timers.tick(SABER.tickMs);
  assert.deepEqual(frames.at(-1)!.saberStart,{startsAtMs:null,unlocked:false});
  mock.timers.tick(1000);match.setSaberPaired(2,true);tick();
  assert.ok(frames.at(-1)!.saberStart!.startsAtMs!>before);
  assert.equal(match.saberCombatReady,false);
});

test("rematch resets the shared gate and stale inputs cannot unlock it",()=>{
  tick();
  while(!match.saberCombatReady) tick();
  match.handleCommand(1,{commandId:"forfeit",type:"forfeit"});
  match.handleCommand(1,{commandId:"rematch-one",type:"rematch"});
  match.handleCommand(2,{commandId:"rematch-two",type:"rematch"});
  assert.equal(match.saberCombatReady,false);
  tick();
  assert.equal(match.toView(1).startsInMs,SABER_COUNTDOWN_MS);
  mock.timers.tick(SABER_COUNTDOWN_MS+SABER.tickMs);
  assert.equal(match.saberCombatReady,false,"expired streams cancel the rematch countdown");
  assert.equal(match.toView(1).startsInMs,null);
  tick();
  assert.equal(match.toView(1).startsInMs,SABER_COUNTDOWN_MS,"recovery starts a full fresh countdown");
  while(!match.saberCombatReady) tick();
  assert.equal(frames.at(-1)!.saberStart!.unlocked,true);
});
