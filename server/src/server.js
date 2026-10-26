import { app } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { recoverPendingMediaJobs } from './services/mediaGeneration.service.js';

let httpServer;

async function start() {
  try {
    await connectDatabase();
    await recoverPendingMediaJobs();
    httpServer = app.listen(env.PORT, () => {
      console.info(`AI Mystery Room API listening on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
  }
}

async function shutdown(signal) {
  console.info(`${signal} received; shutting down.`);
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await disconnectDatabase();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await start();
