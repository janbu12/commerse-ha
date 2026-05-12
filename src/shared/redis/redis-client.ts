import { Redis } from 'ioredis';
import type { RedisPort } from './redis.port.js';

export class RedisClient implements RedisPort {
  public readonly client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true
    });
  }

  async healthCheck() {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
    await this.client.ping();
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }
    await this.client.set(key, value);
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async close() {
    await this.client.quit();
  }
}
