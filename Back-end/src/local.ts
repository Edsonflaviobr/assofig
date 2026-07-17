import app from './app.mjs';
import { env } from './config/env.js';
import { pool } from './db/pool.js';

const server = app.listen(env.PORT, () => {
  console.log(`API ASSOFIG disponível em http://localhost:${env.PORT}/api`);
});

async function shutdown(signal: string) {
  console.log(`${signal} recebido; encerrando...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
