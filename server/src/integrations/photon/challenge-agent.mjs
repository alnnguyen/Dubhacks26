export function parseOrder(text) {
  const match = /^(ACCEPT|DECLINE|STATUS)\s+([A-Z0-9][A-Z0-9_-]{0,63})$/i.exec(text.trim());
  return match ? { action: match[1].toLowerCase(), challengeId: match[2].toUpperCase() } : null;
}

export function trustedMessage(m, { sender, agent }) {
  return m?.platform === 'imessage' && m.status === 'received'
    && m.sentBy?.kind === 'human' && m.sentBy.platform === 'imessage' && m.sentBy.handle === sender
    && m.receivedBy?.kind === 'agent' && m.receivedBy.platform === 'imessage' && m.receivedBy.handle === agent
    && m.space?.kind === 'direct' && m.space.platform === 'imessage'
    && /^pho_msg_[a-z0-9]+$/.test(m.id ?? '')
    && typeof m.space.id === 'string' && typeof m.receivedBy.id === 'string'
    && m.content?.type === 'text' && m.content.format === 'plain' && typeof m.content.text === 'string';
}

// Run serially per actor. Journal and game command IDs survive provider retries.
export function challengeAgent({ port, photon, journal, identity }) {
  let tail = Promise.resolve();
  async function process(m) {
    if (!trustedMessage(m, identity)) return { ignored: true };
    let record = await journal.transact(data => data[m.id] ?? null);
    if (record?.sent) return { duplicate: true };
    if (!record) {
      const order = parseOrder(m.content.text);
      let text;
      if (!order) text = 'Ship AI: use ACCEPT <challenge ID>, DECLINE <challenge ID>, or STATUS <challenge ID>.';
      else {
        try {
          const challenge = order.action === 'status'
            ? await port.getChallenge({ actorId: identity.playerId, challengeId: order.challengeId })
            : await port.respondChallenge({ actorId: identity.playerId, challengeId: order.challengeId,
              decision: order.action, commandId: `photon:${m.id}` });
          text = `${challenge.fixture ? '[FIXTURE DEMO] ' : ''}Ship AI: ${challenge.id} is ${challenge.status}.`;
        } catch {
          // Don't disclose another player's state or arbitrary upstream error details.
          text = 'Ship AI: that challenge is unavailable, expired, or cannot accept this action. Check the game.';
        }
      }
      record = { text, sent: false };
      await journal.transact(data => { data[m.id] = record; });
    }
    const result = await photon.send(m, record.text);
    await journal.transact(data => { data[m.id] = { ...record, sent: true, outboundId: result.id }; });
    return { messageId: m.id, outboundId: result.id, status: result.status, accepted: true };
  }
  return m => {
    const operation = tail.then(() => process(m));
    tail = operation.catch(() => {});
    return operation;
  };
}
