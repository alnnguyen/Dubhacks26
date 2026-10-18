import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig } from "./config.js";
import { startServer } from "./server.js";

// Reuse D's ignored server-only key file when no deployment environment key is set.
const voiceEnv = resolve(import.meta.dirname, '..', '.env.grok.local');
if (!process.env.XAI_API_KEY && existsSync(voiceEnv)) process.loadEnvFile(voiceEnv);

const config = loadConfig();
const server = await startServer(config);
console.log(`Game server listening on port ${server.port}; allowed origins: ${config.allowedOrigins.join(", ")}`);
