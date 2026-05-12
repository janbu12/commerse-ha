export type AppConfig = {
  nodeEnv: string;
  port: number;
  appInstanceId: string;
  databaseUrl: string;
  databaseReplicaUrl?: string;
  redisUrl: string;
  jwtSecret: string;
  cookieSecret: string;
  midtransWebhookSecret: string;
  midtransServerKey?: string;
  midtransClientKey?: string;
  lokiUrl?: string;
  logLevel: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: Number(env.APP_PORT ?? 3001),
    appInstanceId: env.APP_INSTANCE_ID ?? 'api-local',
    databaseUrl: env.DATABASE_URL ?? 'postgresql://ecommerce:ecommerce@localhost:5432/ecommerce',
    databaseReplicaUrl: env.DATABASE_REPLICA_URL,
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
    jwtSecret: env.JWT_SECRET ?? 'development-jwt-secret-change-me',
    cookieSecret: env.COOKIE_SECRET ?? 'development-cookie-secret-change-me',
    midtransWebhookSecret: env.MIDTRANS_WEBHOOK_SECRET ?? 'development-webhook-secret',
    midtransServerKey: env.MIDTRANS_SERVER_KEY,
    midtransClientKey: env.MIDTRANS_CLIENT_KEY,
    lokiUrl: env.LOKI_URL,
    logLevel: env.LOG_LEVEL ?? 'info'
  };
}
