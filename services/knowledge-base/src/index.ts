import { createHealthServer } from '@agenthub/shared/server';

const port = Number(process.env.KNOWLEDGE_BASE_PORT) || 3003;

async function main(): Promise<void> {
  const server = createHealthServer({ serviceName: 'knowledge-base', port });

  const shutdown = async (signal: string) => {
    console.log(`knowledge-base received ${signal}, shutting down...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`knowledge-base listening on :${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

void main();
