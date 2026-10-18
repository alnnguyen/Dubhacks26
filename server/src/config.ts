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

/** Replay HTTP uploads follow the same explicit origin list as game HTTP transport. */
export function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  return !origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*");
}
