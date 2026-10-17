// D-owned integration port. B supplies the implementation; this is not B's contract.
export function validateGamePort(port) {
  for (const method of ['getChallenge', 'respondChallenge', 'getMatchState']) {
    if (typeof port?.[method] !== 'function') throw new Error(`Game adapter must implement ${method}`);
  }
  return port;
}

export async function matchTool(port, actorId) {
  const state = await port.getMatchState({ actorId });
  if (!state) return { available: false, message: 'No match has been selected for this player.' };
  // Only expose the small public snapshot, never credentials or provider identities.
  return {
    available: true, fixture: state.fixture === true, matchId: state.matchId,
    phase: state.phase, world: state.world, gravityMps2: state.gravityMps2,
    rockFlightSeconds: state.rockFlightSeconds,
  };
}
