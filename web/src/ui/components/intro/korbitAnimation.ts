// Adapted from Alan's supplied korbit-intro.html. Scoped, finite and cleaned up on unmount.
export function createKorbitAnimation(root: HTMLElement, onSettled: () => void) {
const DURATION = 4000;                 // Finite intro length; no idle render loop.
const $ = (s: string) => root.querySelector<HTMLElement>(s)!;
const $$ = (s: string) => [...root.querySelectorAll<HTMLElement>(s)];
const shake=$('#k-shake'), cv=$('#k-fx') as HTMLCanvasElement, context=cv.getContext('2d');
if (!context) { onSettled(); return { play() {}, finish() {}, destroy() {} }; }
const ctx = context;
const big=$('#k-big'), bK=$('#k-big .bk'), bO=$('#k-big .bo'), bD=$$('#k-big .bd'), band=$('#k-band');
const lK=$('.k-logo .k-K'), lO=$('.k-logo .k-O'), lDot=$('.k-logo .k-dot'), lR=$$('.k-logo .k-r');
const logoBg=$('.k-logo-bg'), shineEl=$('.k-logo-bg b');
const welcome=$('.k-welcome'), btn=$('.k-actions');
const hudTL=$('.k-tl'), hudTR=$('.k-tr'), hudBL=$('.k-bl'), planet=$('.k-planet'), lines=$$('.k-line');
$$('#k-band p').forEach(p=>p.textContent='◆ KNOCKOUT '.repeat(24));
// planet meridians
{const g=$('.k-planet-mer');g.replaceChildren();for(let i=1;i<6;i++){const e=document.createElementNS('http://www.w3.org/2000/svg','ellipse');e.setAttribute('rx',(100*Math.cos(i*Math.PI/12)).toFixed(1));e.setAttribute('ry','100');e.setAttribute('opacity','.5');g.appendChild(e);}}

// ---------- math helpers ----------
const clamp=(v: number,a=0,b=1)=>Math.min(b,Math.max(a,v));
const seg=(t: number,a: number,b: number)=>clamp((t-a)/(b-a));
const lerp=(a: number,b: number,p: number)=>a+(b-a)*p;
const eOutCubic=(p: number)=>1-Math.pow(1-p,3), eInCubic=(p: number)=>p*p*p, eInQuart=(p: number)=>p*p*p*p;
const eInOut=(p: number)=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
const eOutExpo=(p: number)=>p>=1?1:1-Math.pow(2,-10*p);
const eOutBack=(p: number,s=1.9)=>1+(s+1)*Math.pow(p-1,3)+s*Math.pow(p-1,2);
function rng(seed: number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const mix=(c1: number[],c2: number[],p: number)=>c1.map((v,i)=>Math.round(lerp(v,c2[i],p)));
const RED=[255,114,127], WHITE=[244,251,255], CYAN=[135,220,255];
const rgba=(c: number[],a=1)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ---------- deterministic particle sets ----------
function makeShards(seed: number,n: number,speed: number){const r=rng(seed);return Array.from({length:n},()=>({a:r()*Math.PI*2,v:speed*(0.35+r()),s:4+r()*14,rot:r()*6,vr:(r()-.5)*20,life:450+r()*500,c:r()<.2?WHITE:(r()<.5?[255,140,60]:RED)}));}
const SH_K=makeShards(7,18,0.9), SH_O=makeShards(11,46,1.4), SH_C=makeShards(23,26,0.8);
const STREAKS=(()=>{const r=rng(3);return Array.from({length:16},()=>({y:r()-.5,l:.4+r()*.9,w:1+r()*3}));})();

// ---------- layout measurement (rest positions, no transforms) ----------
type Box = { x:number; y:number; w:number; h:number };
let M!: {bK:Box;bO:Box;lK:Box;lO:Box;big:Box};
let W=0, H=0, DPR=1;
function measure(){
  const els=[shake,bK,bO,lK,lO,big];
  const saved=els.map(e=>e.style.transform);
  els.forEach(e=>{if(e!==big)e.style.transform='none';});
  big.style.transform='';
  const r=(e: Element)=>{const b=e.getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2,w:b.width,h:b.height};};
  M={bK:r(bK),bO:r(bO),lK:r(lK),lO:r(lO),big:r(big)};
  els.forEach((e,i)=>e.style.transform=saved[i]);
  W=innerWidth;H=innerHeight;DPR=Math.min(1.5,devicePixelRatio||1);
  cv.width=W*DPR;cv.height=H*DPR;
}

// ---------- the renderer: everything is a pure function of t ----------
function render(t: number){
  if(!M)measure();
  const vw=W/100, vmin=Math.min(W,H)/100;

  // screen shake: decaying impulses at each impact
  let sx=0,sy=0;
  for(const [ti,A] of [[420,3],[700,5],[1950,2],[2500,3]]){
    if(t>=ti){const d=Math.exp(-(t-ti)/90)*A*vmin/8;sx+=d*Math.sin((t-ti)*.11+ti);sy+=d*Math.cos((t-ti)*.13+ti*.7);}
  }
  shake.style.transform=`translate(${sx.toFixed(2)}px,${sy.toFixed(2)}px)`;

  // ===== BEAT 1-2: K and O slam in =====
  const kTo=seg(t,1500,1950), redFade=seg(t,1450,1800);
  // K
  { let x=0,o=1,sc=1,scx=1,scy=1;
    if(t<200){o=0;x=0;}
    else if(t<420){const p=eInCubic(seg(t,200,420));x=lerp(-1.1*W,0,p);sc=lerp(1.6,1,p);scx=lerp(1.5,1,p);}
    else{x=0;const p=seg(t,420,600);scx=lerp(1.18,1,eOutBack(p));scy=lerp(.86,1,eOutBack(p));}
    // fly to logo K
    const dx=(M.lK.x-M.bK.x)*eInOut(kTo), dy=(M.lK.y-M.bK.y)*eInOut(kTo), s=lerp(1,M.lK.h/M.bK.h,eInOut(kTo));
    if(t>=1950)o=0;
    const c=mix(RED,WHITE,redFade);
    bK.style.opacity=String(o);bK.style.color=rgba(c);
    bK.style.textShadow=`0 0 ${0.08*(1-redFade)}em ${rgba(RED,.9*(1-redFade))}, ${-0.03*(1-redFade)}em 0 0 rgba(62,232,255,${.55*(1-redFade)})`;
    bK.style.transform=`translate(${x+dx}px,${dy}px) scale(${sc*s*scx},${sc*s*scy})`;
  }
  // O
  { let x=0,o=1,sc=1,rot=0,scx=1,scy=1;
    if(t<480){o=0;x=0;}
    else if(t<700){const p=eInCubic(seg(t,480,700));x=lerp(1.1*W,0,p);rot=lerp(-60,0,p);sc=lerp(1.7,1,p);}
    else{x=0;const p=seg(t,700,900);scx=lerp(1.25,1,eOutBack(p));scy=lerp(.8,1,eOutBack(p));}
    // O collapses into a planet
    const pc=seg(t,1500,1650); if(pc>0){sc*=lerp(1,.35,eInCubic(pc));o=1-pc;rot+=pc*-180;}
    const c=mix(RED,WHITE,redFade*.6);
    bO.style.opacity=String(o);bO.style.color=rgba(c);
    bO.style.textShadow=`0 0 .08em ${rgba(RED,.9)}, .03em 0 0 rgba(62,232,255,.55)`;
    bO.style.transform=`translate(${x}px,0) rotate(${rot}deg) scale(${sc*scx},${sc*scy})`;
  }
  // K.O. dots pop, then vanish
  bD.forEach((d,i)=>{const a=820+i*110;const p=seg(t,a,a+180);const out=seg(t,1400,1520);
    d.style.opacity=String((p>0?1:0)*(1-out));d.style.transform=`scale(${eOutBack(p,3)*(1-out)}) rotate(${(1-p)*90}deg)`;});
  // big container jitter while held (fighting game "hit-stop" vibe)
  { const j=(t>720&&t<1450)?Math.sin(t*.9)*1.2:0; big.style.transform=`translate(calc(-50% + ${j}px),-55%)`; }
  // KNOCKOUT band
  { const pin=eOutExpo(seg(t,720,880)), pout=seg(t,1400,1650);
    band.style.opacity=(pin*(1-pout)).toFixed(3);
    band.style.transform=`translateY(-55%) scaleY(${lerp(.2,1,pin)*(1-pout*.7)}) skewY(-4deg)`;
    const ps=[...band.children] as HTMLElement[]; const off=(t*.12)%400;
    ps[0].style.transform=`translateX(${-off}px)`;ps[1].style.transform=`translateX(${off-400}px)`; }

  // ===== BEAT 3-4: logo plate, planet-O smash, letters snap =====
  // plate sweep
  { const p=eOutExpo(seg(t,1850,2250)); logoBg.style.transform=`scaleX(${p})`; logoBg.style.opacity=p>0?'1':'0';
    let sh=-40; if(t>2150&&t<2750)sh=lerp(-40,140,seg(t,2150,2750));
    if(t>DURATION){const c=(t-DURATION)%4500;if(c<700)sh=lerp(-40,140,c/700);}
    shineEl.style.setProperty('--shine',sh+'%'); }
  // logo K lands when big K arrives
  { const p=seg(t,1950,2150); lK.style.opacity=t>=1950?'1':'0'; lK.style.transform=`scale(${lerp(1.18,1,eOutBack(p))})`; }
  // logo O appears on planet smash
  { const p=seg(t,2500,2720); lO.style.opacity=t>=2500?'1':'0'; lO.style.transform=`scale(${lerp(1.5,1,eOutBack(p,2.4))}) rotate(${lerp(-25,0,eOutCubic(p))}deg)`; }
  { const p=seg(t,2540,2720); lDot.style.opacity=p>0?'1':'0'; lDot.style.transform=`scale(${eOutBack(p,3)}) rotate(${(1-p)*135}deg)`; }
  lR.forEach((e,i)=>{const a=2580+i*65, p=seg(t,a,a+230);
    e.style.opacity=String(clamp(p*3));e.style.transform=`translateX(${(1-eOutBack(p,1.6))*0.6}em) skewX(${(1-p)*-25}deg)`;});

  // ===== BEAT 5: HUD + copy settle in =====
  const fade=(el: HTMLElement,a: number,b: number,dy=12,dx=0)=>{const p=eOutCubic(seg(t,a,b));el.style.opacity=String(p);el.style.transform=`translate(${(1-p)*dx}px,${(1-p)*dy}px)`;};
  fade(welcome,2780,3200,12);fade(btn,3100,3550,14);
  fade(hudTL,2850,3300,0,-16);fade(hudTR,2900,3350,0,16);fade(hudBL,3000,3450,0,-16);
  { const p=eOutCubic(seg(t,2600,3700)); const spin=(t>DURATION?(t-DURATION)*.002:0);
    planet.style.opacity=String(p);planet.style.transform=`translate(${(1-p)*8}vmin,${(1-p)*8}vmin) rotate(${(1-p)*-30+spin}deg)`; }
  lines.forEach((l,i)=>{l.style.opacity=lerp(.35,1,seg(t,2600+i*120,3400+i*120)).toFixed(3);});
  if(t>DURATION){const g=.35+.12*Math.sin((t-DURATION)*.003);$('.k-logo-bg i').style.boxShadow=`0 0 .35em rgba(62,232,255,${g}),inset 0 0 0 1px rgba(255,255,255,.25)`;}

  drawFx(t,vw,vmin);
}

// ---------- canvas FX ----------
function drawFx(t: number,vw: number,vmin: number){
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,W,H);
  ctx.lineCap='round';
  // 0: anticipation scanline
  if(t<240){const p=seg(t,0,200);ctx.fillStyle=rgba(RED,.8*(1-seg(t,160,240)));ctx.fillRect(lerp(-.2*W,W,eOutCubic(p))-W*.3,M.big.y-1,W*.3,2);}
  // 1: motion streaks behind incoming K / O
  const streak=(cx: number,cy: number,h: number,dir: number,p: number,alpha: number)=>{ for(const s of STREAKS){const y=cy+s.y*h*.9, len=s.l*W*.5*(1-p*.2);
      const g=ctx.createLinearGradient(cx,y,cx-dir*len,y);g.addColorStop(0,rgba([255,120,120],alpha));g.addColorStop(1,rgba(RED,0));
      ctx.strokeStyle=g;ctx.lineWidth=s.w;ctx.beginPath();ctx.moveTo(cx-dir*h*.25,y);ctx.lineTo(cx-dir*len,y);ctx.stroke();}};
  if(t>200&&t<560){const p=eInCubic(seg(t,200,420));streak(M.bK.x+lerp(-1.1*W,0,p),M.bK.y,M.bK.h,1,p,t<420?.9:.9*(1-seg(t,420,560)));}
  if(t>480&&t<840){const p=eInCubic(seg(t,480,700));streak(M.bO.x+lerp(1.1*W,0,p),M.bO.y,M.bO.h,-1,p,t<700?.9:.9*(1-seg(t,700,840)));}
  // 2: steady radial speed lines during KO hold (no flicker)
  if(t>700&&t<1550){const r=rng(3), a=.55*(1-seg(t,1350,1550)), cx=M.big.x, cy=M.big.y, R=Math.hypot(W,H);
    for(let i=0;i<46;i++){const ang=r()*Math.PI*2, r0=R*(.28+r()*.18), w=1+r()*3;
      ctx.strokeStyle=rgba(r()<.25?WHITE:RED,a*(.4+r()*.6));ctx.lineWidth=w;ctx.beginPath();
      ctx.moveTo(cx+Math.cos(ang)*r0,cy+Math.sin(ang)*r0);ctx.lineTo(cx+Math.cos(ang)*R,cy+Math.sin(ang)*R);ctx.stroke();}}
  // 3: shards
  const shards=(set: ReturnType<typeof makeShards>,t0: number,cx: number,cy: number,scale: number)=>{ if(t<t0)return; const dt=t-t0;
    for(const s of set){ if(dt>s.life)continue; const k=dt/s.life, d=s.v*dt*scale*(1-k*.5);
      const x=cx+Math.cos(s.a)*d, y=cy+Math.sin(s.a)*d+0.0009*dt*dt*scale;
      ctx.save();ctx.translate(x,y);ctx.rotate(s.rot+s.vr*k);ctx.globalAlpha=1-k;ctx.fillStyle=rgba(s.c);
      ctx.beginPath();ctx.moveTo(0,-s.s*scale);ctx.lineTo(s.s*.45*scale,s.s*.5*scale);ctx.lineTo(-s.s*.4*scale,s.s*.3*scale);ctx.closePath();ctx.fill();ctx.restore();}};
  const sc=vmin/8;
  shards(SH_K,420,M.bK.x,M.bK.y,sc);
  shards(SH_O,700,(M.bK.x+M.bO.x)/2,M.bO.y,sc);
  // impact rings
  const ring=(t0: number,dur: number,cx: number,cy: number,r1: number,col: number[],lw: number)=>{ if(t<t0||t>t0+dur)return; const p=seg(t,t0,t0+dur);
    ctx.strokeStyle=rgba(col,1-p);ctx.lineWidth=lw*(1-p)+1;ctx.beginPath();ctx.arc(cx,cy,r1*eOutCubic(p),0,Math.PI*2);ctx.stroke();};
  ring(700,420,M.big.x,M.big.y,Math.max(W,H)*.6,WHITE,14);
  ring(420,320,M.bK.x,M.bK.y,M.bK.h*.9,RED,8);

  // 4: the O becomes a planet with an orbit ring, rises, then smashes into the logo
  if(t>=1500&&t<2620){
    const p1=eInOut(seg(t,1520,2200)), hover=seg(t,2200,2360), p3=eInQuart(seg(t,2360,2500));
    const R0=M.bO.h*.3, R1=M.lO.h*.62, Rf=M.lO.h*.36;
    const hx=M.lO.x+ (W>H?.10*W:.05*W), hy=M.lO.y-Math.max(M.lO.h*1.5,14*vmin);   // hover point
    // curve from big O -> hover point (quadratic bezier with high control)
    const cx0=M.bO.x, cy0=M.bO.y, ctlx=lerp(cx0,hx,.5)+.12*W, ctly=Math.min(cy0,hy)-12*vmin;
    let x=(1-p1)*(1-p1)*cx0+2*(1-p1)*p1*ctlx+p1*p1*hx, y=(1-p1)*(1-p1)*cy0+2*(1-p1)*p1*ctly+p1*p1*hy;
    y-=Math.sin(hover*Math.PI)*2*vmin;
    x=lerp(x,M.lO.x,p3); y=lerp(y,M.lO.y,p3);
    let R=lerp(lerp(R0,R1,p1),Rf,p3)*eOutBack(seg(t,1500,1640),2);
    const col=mix(RED,CYAN,seg(t,1550,2000));
    const alpha=1-seg(t,2500,2620);
    const spin=t*.006 + hover*hover*4;
    ctx.globalAlpha=alpha;
    // trail while smashing
    if(p3>0&&p3<1){ctx.strokeStyle=rgba(CYAN,.5);ctx.lineWidth=R*1.2;ctx.beginPath();ctx.moveTo(lerp(hx,M.lO.x,Math.max(0,p3-.35)),lerp(hy,M.lO.y,Math.max(0,p3-.35)));ctx.lineTo(x,y);ctx.stroke();}
    const tilt=-.35, rx=R*2.1, ry=R*.55;
    // back half of ring
    ctx.strokeStyle=rgba(WHITE,.85);ctx.lineWidth=Math.max(1.5,R*.07);
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,tilt,Math.PI,Math.PI*2);ctx.stroke();
    // planet body
    const g=ctx.createRadialGradient(x-R*.35,y-R*.4,R*.1,x,y,R);
    g.addColorStop(0,'#ffffff');g.addColorStop(.35,rgba(col));g.addColorStop(1,rgba(mix(col,[10,20,80],.7)));
    ctx.shadowColor=rgba(col,.9);ctx.shadowBlur=R*.9;
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    // surface bands rotating
    ctx.save();ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.clip();ctx.strokeStyle=rgba(WHITE,.25);ctx.lineWidth=Math.max(1,R*.06);
    for(let i=-2;i<=2;i++){ctx.beginPath();ctx.ellipse(x+Math.sin(spin+i)*R*.15,y+i*R*.38,R*1.1,R*.12,tilt*.5,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    // front half of ring + moon
    ctx.strokeStyle=rgba(WHITE,.95);ctx.lineWidth=Math.max(1.5,R*.07);
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,tilt,0,Math.PI);ctx.stroke();
    const ma=spin*1.6, mx=x+Math.cos(ma)*rx*Math.cos(tilt)-Math.sin(ma)*ry*Math.sin(tilt), my=y+Math.cos(ma)*rx*Math.sin(tilt)+Math.sin(ma)*ry*Math.cos(tilt);
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(mx,my,Math.max(2,R*.13),0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }
  // smash impact: cyan shockwave + orbit ring that lingers around the logo O
  ring(2500,500,M.lO.x,M.lO.y,M.lO.h*2.4,CYAN,10);
  ring(1950,300,M.lK.x,M.lK.y,M.lK.h*1.2,WHITE,5);
  shards(SH_C.map(s=>({...s,c:s.c===RED?CYAN:s.c===WHITE?WHITE:[140,200,255]})),2500,M.lO.x,M.lO.y,sc*.7);
  if(t>2500&&t<3200){const p=seg(t,2500,3200);ctx.strokeStyle=rgba(CYAN,.8*(1-p));ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(M.lO.x,M.lO.y,M.lO.h*lerp(.8,1.6,eOutCubic(p)),M.lO.h*lerp(.22,.4,eOutCubic(p)),-.35,0,Math.PI*2);ctx.stroke();}
}


let start=0, raf=0, elapsed=0, last=0, destroyed=false, settled=false;
function frame(now: number) {
  if (destroyed || document.hidden) return;
  elapsed=Math.min(DURATION, now-start);
  if (now-last>=1000/30 || elapsed===DURATION) { render(elapsed); last=now; }
  if (elapsed<DURATION) raf=requestAnimationFrame(frame);
  else if (!settled) { settled=true; onSettled(); }
}
function play() {
  if (destroyed) return;
  cancelAnimationFrame(raf); measure(); elapsed=0; settled=false; render(0);
  start=performance.now(); last=0; raf=requestAnimationFrame(frame);
}
function finish() { cancelAnimationFrame(raf); elapsed=DURATION; measure(); render(DURATION); if (!settled) { settled=true; onSettled(); } }
function visibility() {
  cancelAnimationFrame(raf);
  if (!document.hidden && !destroyed && elapsed<DURATION) { start=performance.now()-elapsed; raf=requestAnimationFrame(frame); }
}
function resize() { measure(); render(elapsed); }
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',visibility);
measure(); render(0);
void document.fonts.ready.then(() => { if (!destroyed) resize(); });
return { play, finish, destroy() { destroyed=true; cancelAnimationFrame(raf); window.removeEventListener('resize',resize); document.removeEventListener('visibilitychange',visibility); } };
}
