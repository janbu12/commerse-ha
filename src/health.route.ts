import type { FastifyInstance } from 'fastify';
import type { SqlDatabase } from './shared/database/database.port.js';
import type { RedisPort } from './shared/redis/redis.port.js';

export function registerHealthRoute(
  app: FastifyInstance,
  dependencies: { database: SqlDatabase; redis: RedisPort; instanceId: string }
) {
  app.get('/health', async (_request, reply) => {
    const uptime = Math.floor(process.uptime());
    const [database, redis] = await Promise.allSettled([
      dependencies.database.healthCheck(),
      dependencies.redis.healthCheck()
    ]);

    const payload = {
      status: database.status === 'fulfilled' && redis.status === 'fulfilled' ? 'ok' : 'error',
      database: database.status === 'fulfilled' ? 'connected' : 'disconnected',
      redis: redis.status === 'fulfilled' ? 'connected' : 'disconnected',
      uptime,
      instanceId: dependencies.instanceId
    };

    return reply.status(payload.status === 'ok' ? 200 : 503).send(payload);
  });
}
