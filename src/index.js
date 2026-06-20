// Entry point: starts the API server and the automatic refresh scheduler.
import { config } from './config.js';
import { createServer } from './server.js';
import { startScheduler } from './scheduler.js';

const server = createServer();

server.listen(config.port, () => {
  console.log(`Bus Challan Checker running on http://localhost:${config.port}`);
  console.log(`  Dashboard : http://localhost:${config.port}/`);
  console.log(`  API base  : http://localhost:${config.port}/api`);
  console.log(`  Provider  : ${config.provider}`);
  if (!config.apiKey) {
    console.log('  WARNING   : API_KEY is empty — the API is unprotected. Set one in .env.');
  }
  startScheduler();
});

const shutdown = () => {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
