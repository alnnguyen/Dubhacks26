import type { LobbyViewModel, NearbyPilot } from '../ui/state/lobbyTypes';
export interface GuideAnswer { text: string; pilotId?: string; radar?: boolean }

export function recommendPilot(lobby: LobbyViewModel): NearbyPilot | undefined {
  const selfGames = lobby.self.record.wins + lobby.self.record.losses;
  const selfRate = (lobby.self.record.wins + 1) / (selfGames + 2);
  return lobby.nearby.filter(p => p.status === 'available').sort((a, b) => {
    const rate = (p: NearbyPilot) => (p.record.wins + 1) / (p.record.wins + p.record.losses + 2);
    return Math.abs(rate(a) - selfRate) - Math.abs(rate(b) - selfRate) || a.id.localeCompare(b.id);
  })[0];
}

/** Explicitly labeled local guide; never presented as a model response. */
export function guideAnswer(question: string, lobby: LobbyViewModel, demo: boolean): GuideAnswer {
  const q = question.toLowerCase();
  const source = demo ? 'These are simulated pilots in Demo mode.' : 'This uses the currently displayed live roster.';
  if (/matchup|opponent|rival|who|find.*(pilot|match)|challenge someone/.test(q)) {
    if (lobby.connection !== 'online') return {text: 'The roster is not connected yet. Switch to Live and wait for ONLINE, or choose Demo to rehearse with simulated pilots.', radar: true};
    const pilot = recommendPilot(lobby);
    if (!pilot) return {text: `No available pilots are listed right now. ${source} Ask your friend to open the same game link in Live mode.`, radar: true};
    const games = pilot.record.wins + pilot.record.losses;
    return {text: `${pilot.callsign} is listed as available. ${games ? `Their record is ${pilot.record.wins} wins and ${pilot.record.losses} losses; this is a simple record-based suggestion, not a skill rating.` : 'There is no match history yet, so this is an available opponent rather than a measured skill match.'} ${source} Open their Radar card, then confirm Challenge.`, pilotId: pilot.id};
  }
  if (/galaxy|navigat|radar|where.*go|find.*(people|player)/.test(q)) return {text: 'Navigate the galaxy from your cockpit. Open Radar at the bottom to find available pilots, select a rival, then press Challenge. Once they accept, you can launch into battle.', radar: true};
  if (/world|planet|mars|neptune|gravity|arena/.test(q)) return {text: 'The server picks Mars or Neptune when a challenge is accepted. Mars has 3.7 m/s² gravity on NASA MOLA terrain with artistic detail; Neptune has 11.2 m/s² and a fictional floating station above its clouds. Ask live Grok Voice after acceptance for your actual match state.'};
  if (/block|parry|defen/.test(q)) return {text: 'Hold your blade in the path of your rival’s swing to block. A blocked swing deals no damage and briefly stops you swinging back.'};
  return {text: 'Your laptop camera tracks your body and your paired phone is the saber: swing it to strike, and hold your blade in the rival’s path to block. Swipe on the phone to step: forward and back change distance, left and right circle your rival. The server decides every hit, block and result.'};
}
