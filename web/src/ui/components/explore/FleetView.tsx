import { motion, useReducedMotion } from 'motion/react';
import spacex from './data/spacex.json';

/** Launch Library 2 statuses that mean the flight already happened. */
const FLOWN = new Set(['Success', 'Failure', 'Partial Failure']);
const isFlown = (status?: string | null) => !!status && FLOWN.has(status);
const year = (iso: string) => iso.slice(0, 4);

const vehicles = (() => {
  const find = (name: string) => spacex.vehicles.find((v) => v.full_name === name || v.name === name);
  const starship = spacex.vehicles.filter((v) => /^Starship/.test(v.full_name ?? v.name ?? '') || /^Super Heavy/.test(v.name ?? ''));
  const sum = (key: 'total_launch_count' | 'successful_launches' | 'successful_landings' | 'attempted_landings') => starship.reduce((t, v) => t + (v[key] ?? 0), 0);
  const f9 = find('Falcon 9 Block 5'), fh = find('Falcon Heavy');
  return [
    f9 && { name: 'Falcon 9 Block 5', launches: f9.total_launch_count ?? 0, success: f9.successful_launches ?? 0, landings: f9.successful_landings ?? 0, attempts: f9.attempted_landings ?? 0 },
    fh && { name: 'Falcon Heavy', launches: fh.total_launch_count ?? 0, success: fh.successful_launches ?? 0, landings: fh.successful_landings ?? 0, attempts: fh.attempted_landings ?? 0, note: 'Up to three cores land per flight' },
    { name: 'Starship (all versions)', launches: sum('total_launch_count'), success: sum('successful_launches'), landings: sum('successful_landings'), attempts: sum('attempted_landings') },
  ].filter(Boolean) as { name: string; launches: number; success: number; landings: number; attempts: number; note?: string }[];
})();
const boosters = spacex.boosters.filter((b) => b.serial_number && !/^Unknown/i.test(b.serial_number) && b.flights).slice(0, 12);
const maxFlights = Math.max(...boosters.map((b) => b.flights ?? 0), 1);
const starshipFlown = spacex.starshipFlights.filter((f) => isFlown(f.status));
const starshipUpcoming = spacex.starshipFlights.length - starshipFlown.length;
const nroFlown = spacex.nroLaunches.filter((f) => isFlown(f.status));
const nroByYear = Object.entries(nroFlown.reduce<Record<string, number>>((acc, l) => { acc[year(l.net)] = (acc[year(l.net)] ?? 0) + 1; return acc; }, {})).sort();
const capsules = [...spacex.capsules].sort((a, b) => Number(b.status === 'Active') - Number(a.status === 'Active') || (b.flights ?? 0) - (a.flights ?? 0));

/** SpaceX fleet records from the bundled Launch Library 2 snapshot (vehicles, boosters, Dragons, Starship, NRO launches). */
export function FleetView() {
  const reduced = useReducedMotion();
  const rise = (i: number) => (reduced ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * .05, duration: .3 } });
  return (
    <section className="gx-fleet" aria-label="SpaceX fleet records">
      <div className="gx-fleet__vehicles">
        {vehicles.map((v, i) => (
          <motion.article key={v.name} className="gx-fleet__vehicle" {...rise(i)}>
            <p className="gx-eyebrow">Launch vehicle</p>
            <h3>{v.name}</h3>
            <dl>
              <div><dt>Launches</dt><dd>{v.launches.toLocaleString()}</dd></div>
              <div><dt>Successful</dt><dd>{v.success.toLocaleString()}</dd></div>
              <div><dt>Landings</dt><dd>{v.landings.toLocaleString()}<small> / {v.attempts.toLocaleString()} tried</small></dd></div>
            </dl>
            <div className="gx-fleet__bar" aria-label={`${v.success} of ${v.launches} launches successful`}>
              <motion.span initial={reduced ? false : { width: 0 }} animate={{ width: `${v.launches ? (v.success / v.launches) * 100 : 0}%` }} transition={{ duration: .7, delay: .2 + i * .05 }} />
            </div>
            {v.note && <p className="gx-fleet__note">{v.note}</p>}
          </motion.article>
        ))}
      </div>

      <div className="gx-fleet__grid">
        <motion.article className="gx-fleet__panel" {...rise(3)}>
          <h4>Booster reuse <small>most-flown first stages</small></h4>
          <ul className="gx-fleet__boosters">
            {boosters.map((b, i) => (
              <li key={b.serial_number}>
                <span className="gx-fleet__serial">{b.serial_number}</span>
                <span className="gx-fleet__track"><motion.span initial={reduced ? false : { width: 0 }} animate={{ width: `${((b.flights ?? 0) / maxFlights) * 100}%` }} transition={{ duration: .6, delay: .25 + i * .03 }} /></span>
                <b>{b.flights}</b>
              </li>
            ))}
          </ul>
        </motion.article>

        <motion.article className="gx-fleet__panel" {...rise(4)}>
          <h4>Starship test flights <small>{starshipFlown.length} flown · {starshipUpcoming} planned</small></h4>
          <ol className="gx-fleet__timeline" aria-label="Starship flights by outcome">
            {starshipFlown.map((f) => (
              <li key={f.name + f.net} data-status={f.status} title={`${f.name} · ${f.net.slice(0, 10)} · ${f.statusName}`}>
                <span className="gx-sr">{f.name}, {f.net.slice(0, 10)}, {f.statusName}</span>
              </li>
            ))}
          </ol>
          <p className="gx-fleet__legend"><i data-status="Success" /> success <i data-status="Partial Failure" /> partial <i data-status="Failure" /> failure</p>
          <h4>NRO launches on Falcon <small>Starshield-era national-security flights</small></h4>
          <ol className="gx-fleet__years">
            {nroByYear.map(([y, count]) => <li key={y}><b style={{ height: `${10 + count * 14}px` }} /><span>{y}</span><small>{count}</small></li>)}
          </ol>
          <p className="gx-fleet__note">Payload orbits for these missions are not public, so they can't be flown to — only their launch records are shown.</p>
        </motion.article>

        <motion.article className="gx-fleet__panel" {...rise(5)}>
          <h4>Dragon capsules <small>{capsules.filter((c) => c.status === 'Active').length} active of {capsules.length}</small></h4>
          <ul className="gx-fleet__capsules">
            {capsules.map((c) => (
              <li key={c.name} data-status={c.status}>
                <strong>{c.name}</strong>
                <span>{c.status}{c.flights != null ? ` · ${c.flights} flight${c.flights === 1 ? '' : 's'}` : ''}</span>
              </li>
            ))}
          </ul>
        </motion.article>
      </div>
      <p className="gx-dest__source">Source · Launch Library 2 (The Space Devs) snapshot {spacex.retrievedAt.slice(0, 10)} · counts as of retrieval</p>
    </section>
  );
}
