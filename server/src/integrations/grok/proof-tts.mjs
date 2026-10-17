// Server-only Grok Voice TTS proof. Node 22+; no SDK or game dependencies.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BRIEFING =
  'You drew Mars. Gravity is 3.7 meters per second squared. The rock flies longer, so you have more time to block.';

export async function run() {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error('Missing XAI_API_KEY');

  const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
  const outDir = join(root, 'tmp');
  const outFile = join(outDir, 'grok-voice-tts-proof.mp3');
  await mkdir(outDir, { recursive: true });

  let response;
  try {
    response = await fetch('https://api.x.ai/v1/tts', {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: BRIEFING,
        voice_id: 'eve',
        language: 'en',
      }),
    });
  } catch {
    throw new Error('xAI TTS network request failed or timed out (credentials omitted).');
  }

  if (!response.ok) {
    throw new Error(`xAI TTS HTTP ${response.status}; inspect console usage. No response body logged.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 1000) {
    throw new Error('xAI TTS returned an unexpectedly small payload.');
  }

  await writeFile(outFile, buffer);
  const info = await stat(outFile);
  console.log(`TTS VERIFIED: wrote ${info.size} bytes to tmp/grok-voice-tts-proof.mp3`);
  console.log('Note: this is Text-to-Speech (/v1/tts), not Speech-to-Speech realtime yet.');
  console.log('Play: open tmp/grok-voice-tts-proof.mp3');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
