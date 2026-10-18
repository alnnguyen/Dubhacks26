import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { bodyWorldPosition, SOLAR_BODIES } from './bodies';
import { STAR_INDEX, GALAXY_INDEX, starPosition, galaxyPosition, hostLayout } from './catalog';
import type { ExploreDestination, ExploreEnvironment } from './destinations';

export interface FlightBody { id: string; name: string; position: [number, number, number]; radius: number }
export function flightBodies(environment: ExploreEnvironment, destination?: ExploreDestination): FlightBody[] {
  if (environment === 'stars') {
    const star = destination?.bodyId ? STAR_INDEX.get(destination.bodyId) : null;
    return star ? [{ id: star.id, name: star.name, position: starPosition(star), radius: 0.9 }] : [{ id: 'sun', name: 'Sun / Sol', position: [0,0,0], radius: 0.9 }];
  }
  if (environment === 'galaxies') {
    const galaxy = destination?.bodyId ? GALAXY_INDEX.get(destination.bodyId) : null;
    return galaxy ? [{ id: galaxy.id, name: galaxy.alias ?? galaxy.name, position: galaxyPosition(galaxy), radius: 6 }] : [{ id: 'milky-way', name: 'Milky Way origin', position: [0,0,0], radius: 6 }];
  }
  if (environment === 'exoplanets') return [
    { id: `host:${destination?.host ?? ''}`, name: destination?.host ?? 'Host star', position: [0,0,0], radius: 4 },
    ...hostLayout(destination?.host ?? '').map(p => ({ id: p.planet.id, name: p.planet.name, position: p.position, radius: p.radius })),
  ];
  if (environment === 'solar') return SOLAR_BODIES.map(b => ({ ...b, position: bodyWorldPosition(b) }));
  if (environment === 'moon-orbit') return [
    { id: 'moon', name: 'Moon', position: [0, 0, 0], radius: 8 },
    { id: 'earth', name: 'Earth', position: [48, -4, -10], radius: 3.2 * 3.4 },
  ];
  if (environment === 'deep-field') return [
    { id: 'exo-a', name: 'Kepler-proxy', position: [-25, 0, -40], radius: 4.5 },
    { id: 'exo-b', name: 'Gliese-proxy', position: [35, 5, -70], radius: 6.2 },
  ];
  return [];
}
export function nearestFlightBody(position: Vector3, bodies: FlightBody[]) {
  let nearest: { body: FlightBody; distance: number } | null = null;
  for (const body of bodies) {
    const distance = Math.max(0, position.distanceTo(new Vector3(...body.position)) - body.radius);
    if (!nearest || distance < nearest.distance) nearest = { body, distance };
  }
  return nearest;
}

export interface MotionInput { thrust: number; strafe: number; lift: number; yaw: number; pitch: number; brake: boolean; boost: boolean }

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lookOrientation(from: Vector3, look: Vector3, out: Quaternion) {
  if (look.clone().sub(from).lengthSq() < 1e-10) return out.identity();
  // Camera/ship lookAlong -Z matches Matrix4.lookAt.
  const m = new Matrix4().lookAt(from, look, new Vector3(0, 1, 0));
  out.setFromRotationMatrix(m);
  return out;
}

/** All positions are authored scene units, not physical distances. */
export class FlightMotion {
  position = new Vector3();
  velocity = new Vector3();
  rotation = new Euler(0, 0, 0, 'YXZ');
  orientation = new Quaternion();
  private spawnKey = '';
  private targetVelocity = new Vector3();
  private movement = new Vector3();
  private offset = new Vector3();
  private home: { position: Vector3; orientation: Quaternion; rotation: Euler } | null = null;
  private auto: {
    t: number;
    duration: number;
    fromPos: Vector3;
    toPos: Vector3;
    fromQuat: Quaternion;
    toQuat: Quaternion;
    mode: 'to' | 'back';
  } | null = null;
  private scratchQuat = new Quaternion();

  get flying() { return this.auto !== null; }

  // Value-based identity: a React render may supply an equivalent new tuple.
  setSpawn(spawn: readonly number[], yaw: number, pitch: number, token: number) {
    const key = `${spawn.join(',')}:${yaw}:${pitch}:${token}`;
    if (key === this.spawnKey) return;
    this.spawnKey = key;
    this.cancelFlyTo();
    this.home = null;
    this.position.set(spawn[0], spawn[1], spawn[2]);
    this.velocity.set(0, 0, 0);
    this.rotation.set(pitch, yaw, 0, 'YXZ');
    this.orientation.setFromEuler(this.rotation);
  }
  look(dx: number, dy: number) {
    if (this.auto) return;
    this.rotation.y -= dx * 0.003;
    this.rotation.x = Math.max(-1.5, Math.min(1.5, this.rotation.x - dy * 0.003));
    this.orientation.setFromEuler(this.rotation);
  }
  stop() { this.velocity.set(0, 0, 0); }
  cancelFlyTo() { this.auto = null; }
  resetInspection() { this.auto=null; this.home=null; this.stop(); }
  /** Autopilot to a pose looking at `look`. Saves home on first inspect fly-to. */
  flyTo(pos: Vector3, look: Vector3, seconds = 1.2) {
    lookOrientation(pos, look, this.scratchQuat);
    if (!this.home) {
      this.home = {
        position: this.position.clone(),
        orientation: this.orientation.clone(),
        rotation: this.rotation.clone(),
      };
    }
    this.stop();
    this.auto = {
      t: 0,
      duration: Math.max(0.05, seconds),
      fromPos: this.position.clone(),
      toPos: pos.clone(),
      fromQuat: this.orientation.clone(),
      toQuat: this.scratchQuat.clone(),
      mode: 'to',
    };
  }
  flyBack(seconds = 1.2) {
    if (!this.home) { this.cancelFlyTo(); return; }
    this.stop();
    this.auto = {
      t: 0,
      duration: Math.max(0.05, seconds),
      fromPos: this.position.clone(),
      toPos: this.home.position.clone(),
      fromQuat: this.orientation.clone(),
      toQuat: this.home.orientation.clone(),
      mode: 'back',
    };
  }
  step(rawDelta: number, input: MotionInput, bodies: FlightBody[], enabled: boolean, floor?: number, proximitySpeed?: number) {
    const dt = Math.max(0, Math.min(rawDelta, 0.05));
    if (this.auto) {
      this.auto.t += dt;
      const u = easeInOutCubic(Math.min(1, this.auto.t / this.auto.duration));
      this.position.lerpVectors(this.auto.fromPos, this.auto.toPos, u);
      this.orientation.slerpQuaternions(this.auto.fromQuat, this.auto.toQuat, u);
      this.rotation.setFromQuaternion(this.orientation, 'YXZ');
      this.stop();
      if (u >= 1) {
        if (this.auto.mode === 'back') this.home = null;
        this.auto = null;
      }
      return;
    }
    if (!enabled) { this.stop(); return; }
    this.rotation.y += input.yaw * 1.1 * dt;
    this.rotation.x = Math.max(-1.5, Math.min(1.5, this.rotation.x + input.pitch * dt));
    this.orientation.setFromEuler(this.rotation);
    if (input.brake) { this.stop(); return; }
    const distance = nearestFlightBody(this.position, bodies)?.distance ?? 180;
    const speed = (proximitySpeed ?? 24 * Math.max(0.25, Math.min(12, distance / 30))) * (input.boost ? 3 : 1);
    this.targetVelocity.set(input.strafe, input.lift, -input.thrust).clampLength(0, 1)
      .applyQuaternion(this.orientation).multiplyScalar(speed);
    this.velocity.lerp(this.targetVelocity, 1 - Math.exp(-6 * dt));
    // Shed incoming momentum immediately as the local proximity limit shrinks.
    if (proximitySpeed !== undefined) this.velocity.clampLength(0, speed);
    if (this.velocity.lengthSq() < 0.0004) this.stop();
    this.movement.copy(this.velocity).multiplyScalar(dt);
    // Sweep the whole step against each safety sphere, so boost cannot tunnel through a planet.
    let fraction = 1;
    const a = this.movement.lengthSq();
    for (const body of bodies) {
      this.offset.copy(this.position).sub(new Vector3(...body.position));
      const radius = body.radius + 0.8;
      const c = this.offset.lengthSq() - radius * radius;
      if (c < 0) {
        if (this.offset.lengthSq() === 0) this.offset.set(0, 0, 1);
        this.position.copy(this.offset.normalize().multiplyScalar(radius + 0.01)).add(new Vector3(...body.position));
        fraction = 0;
        continue;
      }
      if (a === 0) continue;
      const b = this.offset.dot(this.movement);
      const discriminant = b * b - a * c;
      if (b < 0 && discriminant >= 0) {
        const hit = (-b - Math.sqrt(discriminant)) / a;
        if (hit >= 0 && hit <= fraction) fraction = Math.max(0, hit - 0.001);
      }
    }
    this.position.addScaledVector(this.movement, fraction);
    if (fraction < 1) this.stop();
    if (floor !== undefined && this.position.y < floor) {
      this.position.y = floor;
      this.velocity.y = Math.max(0, this.velocity.y);
    }
  }
}
