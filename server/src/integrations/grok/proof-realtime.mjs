// Live Realtime API test with a WAV speech input and server-side fixture tool.
// Synthesized input is explicitly a test; it is not a human microphone session.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ephemeralToken, voiceSession, runVoiceTool } from './realtime.mjs';
import { fixturePort } from '../demo-state.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const inputPath = process.argv[2];
if (!inputPath) throw new Error('Pass a WAV file: mono PCM16, 24000 Hz.');
const wav = await readFile(inputPath);
if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Expected WAV.');
let pcm, format;
for (let offset = 12; offset + 8 <= wav.length;) {
  const name = wav.toString('ascii', offset, offset + 4), size = wav.readUInt32LE(offset + 4), start = offset + 8;
  if (start + size > wav.length) throw new Error('Truncated WAV.');
  if (name === 'fmt ') format = { encoding: wav.readUInt16LE(start), channels: wav.readUInt16LE(start + 2), rate: wav.readUInt32LE(start + 4), bits: wav.readUInt16LE(start + 14) };
  if (name === 'data') pcm = wav.subarray(start, start + size);
  offset = start + size + (size % 2);
}
if (!pcm?.length || format?.encoding !== 1 || format.channels !== 1 || format.rate !== 24000 || format.bits !== 16) throw new Error('Expected mono PCM16 at 24000 Hz.');
const port = fixturePort(resolve(root, 'tmp/d-provider-demo/voice-state.json'));
if (process.env.D_PROOF_WORLD) await port.setDemoWorld(process.env.D_PROOF_WORLD);
const token = await ephemeralToken(process.env.XAI_API_KEY);
const session = voiceSession();
const chunks = [], toolResults = [], transcripts = [], pending = [], seen = new Set();
let audioStarted = false;
await new Promise((resolveProof, rejectProof) => {
  const ws = new WebSocket('wss://api.x.ai/v1/realtime?model=grok-voice-latest', [`xai-client-secret.${token.value}`]);
  const send = event => ws.send(JSON.stringify(event));
  const timer = setTimeout(() => finish(new Error('Realtime proof timed out.')), 60000);
  let settled = false;
  function finish(error) { if (settled) return; settled = true; clearTimeout(timer); ws.close(); error ? rejectProof(error) : resolveProof(); }
  ws.addEventListener('open', () => send({ type: 'session.update', session }));
  ws.addEventListener('error', () => finish(new Error('Realtime WebSocket failed.')));
  ws.addEventListener('close', () => { if (!settled) finish(new Error('Realtime connection closed before proof completed.')); });
  let queue = Promise.resolve();
  ws.addEventListener('message', ({ data }) => {
    queue = queue.then(async () => {
      const e = JSON.parse(data);
      if (e.type === 'error') throw new Error(`Realtime error: ${e.error?.code ?? 'unknown'} (details omitted).`);
      if (e.type === 'session.updated' && !audioStarted) {
        audioStarted = true;
        for (let i = 0; i < pcm.length; i += 9600) send({ type: 'input_audio_buffer.append', audio: pcm.subarray(i, i + 9600).toString('base64') });
        send({ type: 'input_audio_buffer.commit' }); send({ type: 'response.create' });
      }
      if (e.type === 'response.function_call_arguments.done' && !seen.has(e.call_id)) { seen.add(e.call_id); pending.push(e); }
      if (['response.output_audio.delta', 'response.audio.delta'].includes(e.type)) chunks.push(Buffer.from(e.delta, 'base64'));
      if (['response.output_audio_transcript.done', 'response.audio_transcript.done'].includes(e.type)) transcripts.push(e.transcript);
      if (e.type === 'response.done') {
        if (pending.length) {
          for (const call of pending.splice(0)) {
            const result = await runVoiceTool({ port, actorId: 'pilot-d', name: call.name, arguments: call.arguments });
            toolResults.push(result);
            send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) } });
          }
          send({ type: 'response.create' });
        } else if (toolResults.length && chunks.length) finish();
        else throw new Error('Response completed without both match-state lookup and audio.');
      }
    }).catch(finish);
  });
});
const audio = Buffer.concat(chunks), header = Buffer.alloc(44);
header.write('RIFF'); header.writeUInt32LE(audio.length + 36, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28);
header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(audio.length, 40);
await mkdir(resolve(root, 'tmp/d-provider-demo'), { recursive: true });
await writeFile(resolve(root, 'tmp/d-provider-demo/realtime-response.wav'), Buffer.concat([header, audio]));
console.log(JSON.stringify({ proof: 'REAL REALTIME API, SYNTHESIZED SPEECH INPUT, FIXTURE STATE', audioBytes: audio.length, toolResults, transcripts }, null, 2));
