import { useId } from 'react';
/** Original vector art. Nose points right; the wrapper controls facing and flight. */
export function Ship({team}:{team:'blue'|'red'}) {
 const id=useId().replace(/:/g,'');
 const blue=team==='blue',light=blue?'#b9efff':'#ffd2c7',hot=blue?'#299eff':'#ff604e',dark=blue?'#0e3269':'#69202a';
 return <svg viewBox="0 0 680 360" role="img" aria-label={`${team} fighter starship`}>
  <defs>
   <linearGradient id={`${id}-hull`} x1="0" y1="0" x2="0.7" y2="1"><stop stopColor="#a4c6da" stopOpacity=".7"/><stop offset=".48" stopColor="#243f58" stopOpacity=".85"/><stop offset="1" stopColor="#07131f" stopOpacity=".9"/></linearGradient>
   <linearGradient id={`${id}-wing`} x2=".8" y2="1"><stop stopColor={light}/><stop offset=".4" stopColor={hot}/><stop offset="1" stopColor={dark}/></linearGradient>
   <linearGradient id={`${id}-flame`}><stop stopColor={hot} stopOpacity="0"/><stop offset=".6" stopColor={hot} stopOpacity=".8"/><stop offset="1" stopColor="#f0ffff"/></linearGradient>
   <linearGradient id={`${id}-glass`} x2="1" y2="1"><stop stopColor="#051021"/><stop offset=".6" stopColor={dark}/><stop offset=".8" stopColor={hot}/><stop offset="1" stopColor="#d8faff"/></linearGradient>
  </defs>
  <g className="ship-flame"><path d="M-100 126L116 114L116 145Z" fill={`url(#${id}-flame)`}/><path d="M-160 230L116 214L116 247Z" fill={`url(#${id}-flame)`}/><path d="M-80 180L160 168L160 191Z" fill={`url(#${id}-flame)`}/></g>
  <g stroke={light} strokeOpacity=".55" strokeWidth="1.4" strokeLinejoin="round">
   <path d="M115 130L102 70L190 84L280 151Z" fill={dark}/><path d="M115 230L102 290L190 276L280 209Z" fill={dark}/>
   <path d="M225 165L271 20L372 39L454 164Z" fill={`url(#${id}-wing)`}/><path d="M225 195L271 340L372 321L454 196Z" fill={`url(#${id}-wing)`}/>
   <path d="M270 20L299 28L272 143L245 155Z" fill={light} stroke="none"/><path d="M270 340L299 332L272 217L245 205Z" fill={light} stroke="none"/>
   <path d="M110 135L278 111L451 128L634 180L451 232L278 249L110 225L171 180Z" fill={`url(#${id}-hull)`}/>
   <path d="M179 148L359 141L458 164L522 180L458 196L359 219L179 212L222 180Z" fill={`url(#${id}-wing)`}/>
   <path d="M330 157L423 152L515 180L423 208L330 203L307 180Z" fill={`url(#${id}-glass)`}/>
   <path d="M420 152L418 208M307 180L515 180" stroke={light} strokeWidth="2" opacity=".65"/>
   <path d="M525 157L634 180L525 203L557 180Z" fill={light}/>
   <path d="M126 120L217 125L201 147L117 150Z" fill="#253b53"/><path d="M126 240L217 235L201 213L117 210Z" fill="#253b53"/>
   <path d="M110 121L129 121L129 147L110 147ZM110 213L129 213L129 239L110 239Z" fill={light}/>
   <path d="M255 78L359 87L375 100L248 92Z" fill={light} fillOpacity=".55"/><path d="M255 282L359 273L375 260L248 268Z" fill={light} fillOpacity=".55"/>
   <path d="M351 81L428 87L428 96L351 95ZM351 279L428 273L428 264L351 265Z" fill={dark} strokeWidth="3"/>
  </g>
  <g fill="none" stroke="#e2f7ff" opacity=".5" strokeWidth="2"><path d="M196 158L254 147L280 162M196 202L254 213L280 198M287 35L354 49L414 139M287 325L354 311L414 221"/></g>
  <g fill={light}><rect x="231" y="171" width="28" height="5" transform="rotate(-10 231 171)"/><rect x="231" y="184" width="28" height="5" transform="rotate(10 231 184)"/><circle cx="539" cy="180" r="5"/></g>
 </svg>;
}
