const $ = id => document.getElementById(id);
const base = location.pathname.startsWith('/copilot/') ? '/copilot' : '';
const embeddedWorld = new URLSearchParams(location.search).get('world');
const embedded = window.parent !== window && ['earth', 'mars', 'moon', 'neptune'].includes(embeddedWorld);
let generation = 0;
let briefingGeneration = 0, briefingAbort, briefingUrl;
function stopBriefing() {
  briefingGeneration++; briefingAbort?.abort();
  $('briefing-audio').pause();
  $('briefing-audio').removeAttribute('src');
  if (briefingUrl) URL.revokeObjectURL(briefingUrl);
  briefingUrl = null;
}
async function announce() {
  stopBriefing(); const current = briefingGeneration;
  briefingAbort = new AbortController();
  $('briefing-play').disabled = true;
  $('briefing-status').textContent = 'Your copilot is preparing the world briefing…';
  try {
    const result = await api('/api/briefing', { world: $('world').value }, briefingAbort.signal);
    if (current !== briefingGeneration) return;
    $('briefing-text').textContent = result.text;
    const bytes = Uint8Array.from(atob(result.audioBase64), c => c.charCodeAt(0));
    briefingUrl = URL.createObjectURL(new Blob([bytes], { type: result.contentType }));
    $('briefing-audio').src = briefingUrl;
    $('briefing-play').disabled = false;
    try { await $('briefing-audio').play(); if (current === briefingGeneration) $('briefing-status').textContent = 'Copilot briefing playing.'; }
    catch { if (current === briefingGeneration) $('briefing-status').textContent = 'Briefing ready. Tap Play briefing to enable sound.'; }
  } catch (error) {
    if (current !== briefingGeneration) return;
    $('briefing-status').textContent = 'Briefing unavailable: ' + error.message;
    $('briefing-play').disabled = false;
  }
}
const tellParent = data => { if (embedded) window.parent.postMessage(data, location.origin); };
let ws, context, stream, input, processor, mute, recording = false, toolQueue = [], calls = new Set(), nextAudioAt = 0, sessionTimer;
let speakingAt = 0;
const log = text => { $('log').textContent += text + '\n'; };
const status = text => { $('status').textContent = text; };
async function api(path, body = {}, signal) {
  const r = await fetch(base + path, { signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const value = await r.json(); if (!r.ok) throw new Error(value.error ?? 'Local request failed.'); return value;
}
async function refresh() { const state = await api('/api/state'); $('world').value = state.world; $('state').textContent = JSON.stringify(state, null, 2); }
function send(event) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event)); }
async function disconnect() {
  generation++; stopBriefing(); clearTimeout(sessionTimer); recording = false; processor?.disconnect(); input?.disconnect(); mute?.disconnect();
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  if (ws) { const socket = ws; ws = null; socket.close(); }
  await context?.close().catch(() => {}); context = null;
  $('connect').disabled = false; $('record').disabled = true; $('stop').disabled = true;
  $('record').textContent = 'Start speaking'; $('world').disabled = embedded; status('Disconnected. Microphone stopped.');
}
function playAudio(base64) {
  if (!context) return;
  const binary = atob(base64), bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const view = new DataView(bytes.buffer), audio = context.createBuffer(1, bytes.length / 2, 24000);
  const output = audio.getChannelData(0); for (let i = 0; i < output.length; i++) output[i] = view.getInt16(i * 2, true) / 32768;
  const source = context.createBufferSource(); source.buffer = audio; source.connect(context.destination);
  nextAudioAt = Math.max(context.currentTime + 0.03, nextAudioAt); source.start(nextAudioAt); nextAudioAt += audio.duration;
}
async function eventReceived(e) {
  if (e.type === 'session.updated') { $('record').disabled = false; status('Connected. Start speaking, then press Send speech.'); }
  if (e.type === 'response.function_call_arguments.done' && !calls.has(e.call_id)) { calls.add(e.call_id); toolQueue.push(e); }
  if (['response.output_audio.delta', 'response.audio.delta'].includes(e.type)) playAudio(e.delta);
  if (['response.output_audio_transcript.done', 'response.audio_transcript.done'].includes(e.type)) log(`Copilot: ${e.transcript}`);
  if (e.type === 'conversation.item.input_audio_transcription.completed') log(`You: ${e.transcript}`);
  if (e.type === 'response.done') {
    if (toolQueue.length) {
      const batch = toolQueue; toolQueue = [];
      await Promise.all(batch.map(async call => {
        let result;
        try { result = await api('/api/tool', { name: call.name, arguments: call.arguments }); log(`Tool: ${JSON.stringify(result)}`); }
        catch { result = { available: false, error: 'Match lookup failed. Do not guess.' }; }
        send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) } });
      }));
      send({ type: 'response.create' });
    } else { $('record').disabled = false; status('Response complete. You can ask again.'); }
  }
  if (e.type === 'error') { log(`Voice error: ${e.error?.code ?? 'provider error'}`); await disconnect(); }
}
$('connect').onclick = async () => {
  stopBriefing();
  const current = ++generation;
  $('connect').disabled = true; $('world').disabled = true;
  try {
    context = new AudioContext({ sampleRate: 24000 }); await context.resume(); nextAudioAt = 0;
    const config = await api('/api/token');
    if (current !== generation) return;
    await context.audioWorklet.addModule(base + '/mic-worklet.mjs');
    const acquired = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true }, video: false });
    if (current !== generation) { acquired.getTracks().forEach(t => t.stop()); return; }
    stream = acquired;
    input = context.createMediaStreamSource(stream); processor = new AudioWorkletNode(context, 'microphone-pcm');
    mute = context.createGain(); mute.gain.value = 0; input.connect(processor).connect(mute).connect(context.destination);
    processor.port.onmessage = ({ data }) => {
      if (data.pcm) { let text = ''; for (const b of new Uint8Array(data.pcm)) text += String.fromCharCode(b); send({ type: 'input_audio_buffer.append', audio: btoa(text) }); }
      if (data.stopped) {
        if (performance.now() - speakingAt < 500) { send({ type: 'input_audio_buffer.clear' }); $('record').disabled = false; status('Speak for at least half a second.'); }
        else { send({ type: 'input_audio_buffer.commit' }); send({ type: 'response.create' }); status('Copilot is checking match state…'); }
      }
    };
    const socket = new WebSocket('wss://api.x.ai/v1/realtime?model=grok-voice-latest', [`xai-client-secret.${config.value}`]); ws = socket;
    calls = new Set(); toolQueue = [];
    socket.onopen = () => { send({ type: 'session.update', session: config.session }); $('stop').disabled = false; };
    let events = Promise.resolve();
    socket.onmessage = ({ data }) => { events = events.then(() => eventReceived(JSON.parse(data))).catch(async () => { log('Voice event failed. Reconnect to retry.'); await disconnect(); }); };
    socket.onerror = () => { log('Voice connection failed. Check server credentials/API access.'); disconnect(); };
    socket.onclose = () => { if (ws === socket) disconnect(); };
    sessionTimer = setTimeout(disconnect, 120000); status('Connecting…');
  } catch (error) { await disconnect(); status(error.message); }
};
$('record').onclick = () => {
  if (!recording) { speakingAt = performance.now(); recording = true; processor.port.postMessage('start'); $('record').textContent = 'Send speech'; status('Recording — press Send speech when finished.'); }
  else { recording = false; processor.port.postMessage('stop'); $('record').textContent = 'Start speaking'; $('record').disabled = true; }
};
$('stop').onclick = disconnect;
$('world').onchange = async () => { await disconnect(); try { await api('/api/world', { world: $('world').value }); await refresh(); await announce(); } catch (e) { status(e.message); } };
$('briefing-play').onclick = async () => {
  if ($('briefing-audio').getAttribute('src')) {
    $('briefing-audio').currentTime = 0;
    try { await $('briefing-audio').play(); $('briefing-status').textContent = 'Copilot briefing playing.'; } catch { $('briefing-status').textContent = 'Use the audio player to enable sound.'; }
  } else { await disconnect(); await announce(); }
};
$('briefing-audio').onended = () => { $('briefing-status').textContent = 'Briefing complete. Ready for the jump.'; };
window.addEventListener('pagehide', () => { stopBriefing(); stream?.getTracks().forEach(t => t.stop()); ws?.close(); });
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'COPILOT_STOP') return;
  await disconnect(); tellParent({ type: 'COPILOT_STOPPED' });
});
(async () => {
  if (embedded) {
    $('world').disabled = true;
    await api('/api/world', { world: embeddedWorld });
    document.querySelector('h1').textContent = 'Ship copilot — world briefing';
    tellParent({ type: 'COPILOT_WORLD', world: embeddedWorld });
  }
  await refresh();
  await announce();
})().catch(e => { status(e.message); tellParent({ type: 'COPILOT_ERROR' }); });
