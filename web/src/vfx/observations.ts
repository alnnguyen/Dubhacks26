import type { PlayerView, SaberResolved } from '../../../server/src/contracts';
/** Cosmetic prediction from the last authoritative health snapshot; never used to decide a kill. */
export function isFinishingHit(event: SaberResolved, view: PlayerView | null) {
 if(!view||event.outcome!=='hit'||event.damage<=0)return false;
 const target=event.attackerSlot===view.you.slot?view.rival:view.you;
 return target.health===event.damage;
}
