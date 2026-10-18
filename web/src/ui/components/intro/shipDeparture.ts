// Ship lift-off and banking curves adapted from Alan's korbit-launch.html.
// These are decorative launch craft, never multiplayer contacts.
type Pose = {x:number;y:number;s:number;rot:number;bank:number;fore:number};
export function createShipDeparture(canvas: HTMLCanvasElement, callsign: string, accent: string, onFinished: () => void) {
const context=canvas.getContext('2d');
if (!context) { onFinished(); return () => {}; }
const ctx=context;
let W=0,H=0,DPR=1,U=1;
const rgb=accent.replace('#','');
const ACC=[0,2,4].map(i=>parseInt(rgb.slice(i,i+2),16));
const CALLSIGN=callsign;
function measure() { const bounds=canvas.getBoundingClientRect(); W=bounds.width;H=bounds.height;DPR=Math.min(1.5,devicePixelRatio||1);canvas.width=W*DPR;canvas.height=H*DPR;U=Math.min(W,H)/100; }
const clamp=(v: number,a=0,b=1)=>Math.min(b,Math.max(a,v)), seg=(t: number,a: number,b: number)=>clamp((t-a)/(b-a)), lerp=(a: number,b: number,p: number)=>a+(b-a)*p;
const eOutCubic=(p: number)=>1-Math.pow(1-p,3), eInCubic=(p: number)=>p*p*p, eInOut=(p: number)=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
const eOutBack=(p: number,s=1.7)=>1+(s+1)*Math.pow(p-1,3)+s*Math.pow(p-1,2), eOutExpo=(p: number)=>p>=1?1:1-Math.pow(2,-10*p);
function rng(seed: number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rgba=(c: number[],a=1)=>`rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`;
const mixc=(a: number[],b: number[],p: number)=>a.map((v,i)=>lerp(v,b[i],p));

// player: rises out of the hangar, banks across camera, settles into chase position, foreshortens into the jump
function playerPose(t: number): Pose | null{
  const cx=W/2, chaseY=H*.62;
  if(t<800) return null;
  let x,y,s,rot=0,bank=0,fore=1;
  if(t<1700){const p=eOutCubic(seg(t,800,1700));x=cx;y=lerp(H+30*U,H*.66,p);s=lerp(.55,.9,p);}
  else if(t<2600){const p=eInOut(seg(t,1700,2600));   // bank sweep: right -> left arc, bigger (closer to camera)
    x=cx+Math.sin(p*Math.PI*2)*W*.22; y=H*.66-Math.sin(p*Math.PI)*H*.12; s=.9+Math.sin(p*Math.PI)*.55;
    bank=Math.sin(p*Math.PI*2)*.9; rot=Math.sin(p*Math.PI*2)*.32;}
  else{const p=eOutCubic(seg(t,2600,3100));x=cx;y=lerp(H*.66,chaseY,p);s=.9;}
  // into the jump: tilt away (foreshorten) and shrink toward vanishing point
  const j=eInOut(seg(t,3500,4300)); fore=lerp(1,.5,j); s*=lerp(1,.75,j); y=lerp(y,H*.6,j);
  const out=eInCubic(seg(t,4950,5350)); s*=lerp(1,.05,out); y=lerp(y,H*.5,out);
  if(t>5350)return null;
  // warp rumble
  if(t>4100&&t<4950){x+=Math.sin(t*.07)*.35*U;y+=Math.cos(t*.09)*.35*U;}
  return{x,y,s,rot,bank,fore};
}
const ESCORTS=[{side:-1,dx:-.3,dy:.1,d:0},{side:1,dx:.3,dy:.1,d:90},{side:1,dx:0,dy:-.32,d:180}];
function escortPose(e: typeof ESCORTS[number],t: number): Pose | null{
  const p0=playerPose(Math.max(t,3100)); if(!p0)return null;
  const tin=1900+e.d, tout=3250+e.d*1.2;
  if(t<tin)return null;
  const pin=eOutCubic(seg(t,tin,tin+900)), pout=eInCubic(seg(t,tout,tout+650));
  if(pout>=1)return null;
  const fx=W/2+e.dx*Math.min(W,H)*1.15, fy=H*.62+e.dy*Math.min(W,H)*1.15;    // formation slot
  let x=lerp(W/2+e.side*W*.75,fx,pin), y=lerp(H*1.15,fy,pin);
  x+=e.side*pout*W*.7; y-=pout*H*.35;                                          // peel off
  const bank=e.side*(lerp(-.6,0,pin)+pout*1.1), rot=e.side*(lerp(-.5,0,pin)+pout*.6);
  return{x,y,s:.48*(1+pout*.4),rot,bank,fore:1};
}

// ---------- drawing ----------
function drawShip(P: Pose,t: number,col: number[],name: string | null,escort: boolean){
  const k=P.s*U*.42;
  ctx.save();ctx.translate(P.x,P.y);ctx.rotate(P.rot);ctx.scale(k*(1-Math.abs(P.bank)*.45),k*P.fore);
  // engine glow
  const fl=.9+.1*Math.sin(t*.006+(escort?2:0));
  const eg=ctx.createRadialGradient(0,46,0,0,46,26*fl);
  eg.addColorStop(0,'rgba(255,255,255,.95)');eg.addColorStop(.35,rgba(col,.8));eg.addColorStop(1,rgba(col,0));
  ctx.fillStyle=eg;ctx.beginPath();ctx.ellipse(0,52,22*fl,34*fl,0,0,Math.PI*2);ctx.fill();
  // hull
  const hull=new Path2D('M0,-62 L9,-30 L13,-6 L52,26 L54,36 L16,30 L12,44 L-12,44 L-16,30 L-54,36 L-52,26 L-13,-6 L-9,-30 Z');
  const g=ctx.createLinearGradient(-50,0,50,0);
  const sh=P.bank*.5;
  g.addColorStop(0,`rgb(${30+40*clamp(-sh)},${40+40*clamp(-sh)},${70+50*clamp(-sh)})`);g.addColorStop(.5,'#5a6a92');
  g.addColorStop(1,`rgb(${30+40*clamp(sh)},${40+40*clamp(sh)},${70+50*clamp(sh)})`);
  ctx.fillStyle=g;ctx.fill(hull);
  ctx.strokeStyle=rgba(col,.9);ctx.lineWidth=1.4;ctx.stroke(hull);
  // accent stripes on wings
  ctx.fillStyle=rgba(col,.95);
  ctx.beginPath();ctx.moveTo(22,10);ctx.lineTo(50,30);ctx.lineTo(46,31);ctx.lineTo(20,14);ctx.fill();
  ctx.beginPath();ctx.moveTo(-22,10);ctx.lineTo(-50,30);ctx.lineTo(-46,31);ctx.lineTo(-20,14);ctx.fill();
  // spine panel
  ctx.fillStyle='rgba(10,16,34,.55)';ctx.fillRect(-5,-8,10,46);
  // cockpit glass
  const cg=ctx.createLinearGradient(0,-44,0,-16);cg.addColorStop(0,'#fff');cg.addColorStop(1,rgba(col,.9));
  ctx.fillStyle=cg;ctx.beginPath();ctx.moveTo(0,-46);ctx.lineTo(5,-24);ctx.lineTo(0,-16);ctx.lineTo(-5,-24);ctx.closePath();ctx.fill();
  // engines
  ctx.fillStyle='#fff';ctx.fillRect(-10,42,7,4);ctx.fillRect(3,42,7,4);
  // callsign on the hull (along the spine)
  if(name){ctx.save();ctx.translate(0,15);ctx.rotate(-Math.PI/2);ctx.fillStyle='#fff';
    ctx.font=`italic 900 ${name.length>6?6:8}px "Orbitron", system-ui, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(name,0,0);ctx.restore();}
  ctx.restore();
}
function drawTrail(poseFn: (t: number) => Pose | null,t: number,col: number[],width: number){
  // exhaust trail = past engine positions (deterministic: sample the pose curve backwards)
  for(let i=14;i>=1;i--){const tt=t-i*28;const P=poseFn(tt);if(!P)continue;
    const k=P.s*U*.42, a=(1-i/15)*.55;
    const ex=P.x-Math.sin(P.rot)*48*k*P.fore, ey=P.y+Math.cos(P.rot)*48*k*P.fore;
    ctx.fillStyle=rgba(col,a);ctx.beginPath();ctx.arc(ex,ey,width*k*(1-i/18),0,Math.PI*2);ctx.fill();}
}


const random=rng(42);
const stars=Array.from({length:180},()=>{const angle=random()*Math.PI*2;const r=.05+random();return {x:Math.cos(angle)*r,y:Math.sin(angle)*r,z:random(),w:.6+random()};});
function render(elapsed: number) {
  const t=800+elapsed*1.1;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle='#020814';ctx.fillRect(0,0,W,H);
  const ramp=eInCubic(seg(t,3100,4300));
  const distance=elapsed*.00008+Math.pow(seg(t,3100,4300),3)*.8;
  for (const star of stars) {
    const z=.03+((star.z-distance)%1+1)%1*.97;
    const z2=Math.min(1,z+.008+ramp*.23), f=Math.max(W,H)*.25;
    ctx.strokeStyle=rgba([200,225,255],Math.min(.85,1-z));ctx.lineWidth=star.w;
    ctx.beginPath();ctx.moveTo(W/2+star.x/z2*f,H/2+star.y/z2*f);ctx.lineTo(W/2+star.x/z*f,H/2+star.y/z*f);ctx.stroke();
  }
  // Hangar rails recede as the lead ship lifts off.
  const rail=1-seg(t,1500,2100);
  for(const side of [-1,1]) {ctx.strokeStyle=rgba(ACC,.45*rail);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(W/2+side*W*.35,H);ctx.lineTo(W/2+side*W*.05,H*.55);ctx.stroke();}
  for(const escort of ESCORTS) { const pose=escortPose(escort,t); if(pose){drawTrail(tt=>escortPose(escort,tt),t,ACC,4);drawShip(pose,t,[150,175,205],null,true);} }
  const player=playerPose(t);
  if(player){drawTrail(playerPose,t,ACC,6);drawShip(player,t,ACC,CALLSIGN,false);}
}
let raf=0,start=performance.now(),elapsed=0,last=0,destroyed=false;
function frame(now: number) {
  if(destroyed||document.hidden)return;
  elapsed=Math.min(3200,now-start);
  if(now-last>=1000/30||elapsed===3200){render(elapsed);last=now;}
  if(elapsed<3200)raf=requestAnimationFrame(frame);else onFinished();
}
function visibility(){cancelAnimationFrame(raf);if(!document.hidden&&!destroyed&&elapsed<3200){start=performance.now()-elapsed;raf=requestAnimationFrame(frame);}}
function resize(){measure();render(elapsed);}
measure();render(0);raf=requestAnimationFrame(frame);
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);
return ()=>{destroyed=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);};
}
