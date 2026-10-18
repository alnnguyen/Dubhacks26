import { Matrix4, Vector3 } from 'three';

/** Camera-relative framing: left of the desktop sheet, above a portrait sheet. */
export function inspectStandoff(bodyPos: readonly [number,number,number] | Vector3, radius:number, portrait=false, aspect=16/9) {
  const center=bodyPos instanceof Vector3 ? bodyPos.clone() : new Vector3(...bodyPos);
  const outward=center.clone().setY(0).normalize();if(outward.lengthSq()<1e-8)outward.set(1,0,0);
  const view=outward.negate().applyAxisAngle(new Vector3(0,1,0),.42).add(new Vector3(0,.32,0)).normalize();
  const distance=radius*(portrait?5:3.6);
  const pos=center.clone().addScaledVector(view,distance);
  const basis=new Matrix4().lookAt(pos,center,new Vector3(0,1,0));
  const right=new Vector3().setFromMatrixColumn(basis,0), up=new Vector3().setFromMatrixColumn(basis,1);
  const look=center.clone();
  const span=distance*Math.tan(78*Math.PI/360);
  if(portrait)look.addScaledVector(up,-span*.52);
  else look.addScaledVector(right,span*aspect*.4);
  return {pos,look};
}
