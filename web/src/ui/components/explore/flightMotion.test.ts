import { describe, expect, it } from 'vitest';
import { FlightMotion, flightBodies, type MotionInput } from './flightMotion';
import { DESTINATIONS } from './destinations';
import { scienceForBodyId } from './bodiesScience';
import { Vector3 } from 'three';

const idle: MotionInput = { thrust: 0, strafe: 0, lift: 0, yaw: 0, pitch: 0, brake: false, boost: false };
function fly(ship: FlightMotion, input = { ...idle, thrust: 1 }, frames = 120) {
  for (let i = 0; i < frames; i++) ship.step(1 / 60, input, [], true);
}
describe('persistent flight and movement', () => {
  it('keeps moving across 10 Hz telemetry renders with new equivalent spawn tuples', () => {
    const ship = new FlightMotion();
    ship.setSpawn([10, 0, 100], 0, 0, 0);
    for (let i = 0; i < 20; i++) {
      ship.setSpawn([10, 0, 100], 0, 0, 0);
      fly(ship, { ...idle, thrust: 1 }, 6);
    }
    expect(ship.position.z).toBeLessThan(0);
    expect(ship.position.x).toBe(10);
    ship.setSpawn([10, 0, 100], 0, 0, 1);
    expect(ship.position.z).toBe(100);
    expect(ship.velocity.length()).toBe(0);
  });
  it('starts stopped, moves forward and backward, and brakes to zero', () => {
    const ship = new FlightMotion();
    ship.setSpawn([0, 0, 0], 0, 0, 0);
    fly(ship, idle);
    expect(ship.position.length()).toBe(0);
    fly(ship);
    expect(ship.position.z).toBeLessThan(-100);
    const forward = ship.position.z;
    ship.step(1 / 60, { ...idle, brake: true }, [], true);
    expect(ship.velocity.length()).toBe(0);
    expect(ship.position.z).toBe(forward);
    fly(ship, { ...idle, thrust: -1 });
    expect(ship.position.z).toBeGreaterThan(forward);
  });
  it('freezes during dialogs and clamps a background-tab time jump', () => {
    const ship = new FlightMotion();
    ship.setSpawn([0, 0, 0], 0, 0, 0);
    fly(ship);
    const before = ship.position.clone();
    ship.step(60, { ...idle, thrust: 1 }, [], false);
    expect(ship.position.equals(before)).toBe(true);
    expect(ship.velocity.length()).toBe(0);
    ship.step(60, { ...idle, thrust: 1 }, [], true);
    expect(ship.position.distanceTo(before)).toBeLessThan(8);
  });
  it('steers the flight direction when dragging, independently of cosmetic settings', () => {
    const ship = new FlightMotion();
    ship.look(400, 0);
    fly(ship);
    expect(ship.position.x).toBeGreaterThan(100);
  });
  it('prevents boosting through a planet', () => {
    const ship = new FlightMotion();
    ship.setSpawn([0, 0, 30], 0, 0, 0);
    const body = { id: 'test', name: 'Test', radius: 5, position: [0, 0, 0] as [number, number, number] };
    for (let i = 0; i < 600; i++) ship.step(0.05, { ...idle, thrust: 1, boost: true }, [body], true);
    expect(ship.position.z).toBeGreaterThanOrEqual(5.8);
  });
  it('can turn while stopped without drifting', () => {
    const ship = new FlightMotion();
    ship.setSpawn([0, 0, 0], 0, 0, 0);
    fly(ship, { ...idle, brake: true, yaw: 1 });
    expect(ship.rotation.y).toBeGreaterThan(1);
    expect(ship.position.length()).toBe(0);
  });
  it('keeps surface flight above the ground', () => {
    const ship = new FlightMotion();
    ship.setSpawn([0, 5, 0], 0, 0, 0);
    for (let i = 0; i < 120; i++) ship.step(1 / 60, { ...idle, lift: -1 }, [], true, 4);
    expect(ship.position.y).toBe(4);
  });
  it('flyTo arrives within 1e-3 and flyBack restores the pose', () => {
    const ship = new FlightMotion();
    ship.setSpawn([10, 2, 40], 0.4, -0.1, 0);
    const home = { p: ship.position.clone(), q: ship.orientation.clone() };
    const target = new Vector3(0, 5, 0);
    const look = new Vector3(0, 0, 0);
    ship.flyTo(target, look, 0.5);
    for (let i = 0; i < 90; i++) ship.step(1 / 60, { ...idle, thrust: 1 }, [], false);
    expect(ship.position.distanceTo(target)).toBeLessThan(1e-3);
    expect(ship.flying).toBe(false);
    ship.flyBack(0.5);
    for (let i = 0; i < 90; i++) ship.step(1 / 60, idle, [], false);
    expect(ship.position.distanceTo(home.p)).toBeLessThan(1e-3);
    expect(ship.orientation.angleTo(home.q)).toBeLessThan(1e-3);
  });
});
describe('visit and learn destinations', () => {
  it('arrives outside body safety radii with the target ahead and a learning card', () => {
    for (const dest of DESTINATIONS.filter(d => d.bodyId)) {
      expect(scienceForBodyId(dest.bodyId!)).not.toBeNull();
      const body = flightBodies(dest.environment, dest).find(b => b.id === dest.bodyId);
      if (!body) continue;
      const ship = new FlightMotion();
      ship.setSpawn(dest.spawn, dest.yaw, dest.pitch ?? 0, 0);
      const toward = new Vector3(...body.position).sub(ship.position);
      expect(toward.length()).toBeGreaterThan(body.radius + 0.8);
      expect(toward.normalize().dot(new Vector3(0, 0, -1).applyQuaternion(ship.orientation))).toBeGreaterThan(0.95);
    }
  });
});
