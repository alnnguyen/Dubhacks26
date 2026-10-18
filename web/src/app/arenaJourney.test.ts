import {describe,it,expect} from "vitest";
import type {PlayerView} from "../networking";
import {journeyFor,matchesJourney,saveArenaJourney,readArenaJourney,clearArenaJourney,endedBeforeArrivalNote} from "./arenaJourney";
const view = {matchId:"m1",you:{pilotId:"p1"},rival:{pilotId:"p2"}} as PlayerView;
function memory(){const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)},removeItem:(k:string)=>{data.delete(k)}}}
describe("arena journey restoration",()=>{
 it("restores a launched trip across a remount, then remembers actual arrival",()=>{
  const storage=memory();saveArenaJourney(journeyFor(view,"travel"),storage);
  const trip=readArenaJourney(storage);expect(trip?.stage).toBe("travel");expect(matchesJourney(view,trip)).toBe(true);
  saveArenaJourney(journeyFor(view,"arena"),storage);expect(readArenaJourney(storage)?.stage).toBe("arena");
 });
 it("does not resume an old trip into a new server match reusing its number",()=>{
  const trip=journeyFor(view,"travel");
  expect(matchesJourney({...view,you:{...view.you,pilotId:"new-pilot"}},trip)).toBe(false);
  expect(matchesJourney({...view,rival:{...view.rival,pilotId:"new-rival"}},trip)).toBe(false);
  expect(matchesJourney({...view,matchId:"m2"},trip)).toBe(false);
 });
 it("words a match that ended before arrival from the server's result",()=>{
  const ended={you:{slot:1 as const},rival:{callsign:"REDSHIFT"}};
  expect(endedBeforeArrivalNote({...ended,result:{winner:1,reason:"forfeit"}})).toMatch(/REDSHIFT left before the duel started, so the win is yours/);
  expect(endedBeforeArrivalNote({...ended,result:{winner:2,reason:"forfeit"}})).toMatch(/ended before you arrived/);
  expect(endedBeforeArrivalNote({...ended,result:{winner:null,reason:"forfeit"}})).toMatch(/ended before the duel started/);
  expect(endedBeforeArrivalNote({...ended,result:null})).toMatch(/back in the cockpit/);
 });
 it("explicit leave clears restoration",()=>{const storage=memory();saveArenaJourney(journeyFor(view,"arena"),storage);clearArenaJourney(storage);expect(readArenaJourney(storage)).toBeNull()});
 it("unavailable or malformed session storage cannot break the in-memory flow",()=>{
  const storage={getItem:()=>"broken",setItem:()=>{throw Error("denied")},removeItem:()=>{throw Error("denied")}};
  expect(readArenaJourney(storage)).toBeNull();expect(()=>saveArenaJourney(journeyFor(view,"arena"),storage)).not.toThrow();expect(()=>clearArenaJourney(storage)).not.toThrow();
 });
});
