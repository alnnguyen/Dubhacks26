export interface Config {
  port: number;
  allowedOrigins: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be an integer from 0 to 65535, got "${env.PORT}"`);
  }

  const allowedOrigins = (env.ALLOWED_ORIGIN ?? "http://localhost:5173,https://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return { port, allowedOrigins };
}

/** True for listed origins, plus HTTPS tunnels used for phone camera QA. */
export function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) return true;
  try {
    const host = new URL(origin).hostname;
    return (
      host.endsWith(".ngrok-free.dev") ||
      host.endsWith(".ngrok-free.app") ||
      host.endsWith(".ngrok.io") ||
      host.endsWith(".trycloudflare.com")
    );
  } catch {
    return false;
  }
}
