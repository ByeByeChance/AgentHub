import { createHealthServer } from '@agenthub/shared/server';

const port = Number(process.env.OBSERVABILITY_PORT) || 3004;

async function main(): Promise<void> {
  const server = createHealthServer({ serviceName: 'observability', port });

  const shutdown = async (signal: string) => {
    console.log(`observability received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`observability listening on :${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

void main();
