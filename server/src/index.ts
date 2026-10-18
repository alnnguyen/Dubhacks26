import { loadConfig } from "./config.js";
import { startServer } from "./server.js";

const config = loadConfig();
const server = await startServer(config);
console.log(`Game server listening on port ${server.port}; allowed origins: ${config.allowedOrigins.join(", ")}`);
