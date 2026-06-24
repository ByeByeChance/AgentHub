import { createHealthServer } from '@agenthub/shared/server';

const port = Number(process.env.SKILL_REGISTRY_PORT) || 3002;

async function main(): Promise<void> {
  const server = createHealthServer({ serviceName: 'skill-registry', port });

  const shutdown = async (signal: string) => {
    console.log(`skill-registry received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`skill-registry listening on :${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

void main();
