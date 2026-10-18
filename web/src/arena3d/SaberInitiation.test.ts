import { describe, it, expect } from "vitest";
import { saberCountdown } from "./SaberInitiation";

describe("server-authoritative saber countdown display",()=>{
  it("shows the shared seconds but waits for server GO at and after the deadline",()=>{
    const start={startsAtMs:5000,unlocked:false};
    expect(saberCountdown(start,2000)).toBe(3);
    expect(saberCountdown(start,3000)).toBe(2);
    expect(saberCountdown(start,4999)).toBe(1);
    expect(saberCountdown(start,5000)).toBe(0);
    expect(saberCountdown(start,8000)).toBe(0);
    expect(saberCountdown({...start,unlocked:true},8000)).toBeNull();
  });
  it("doesn't invent a countdown for an old host or while waiting for another pilot",()=>{
    expect(saberCountdown(null,2000)).toBeNull();
    expect(saberCountdown({startsAtMs:null,unlocked:false},2000)).toBeNull();
  });
});
