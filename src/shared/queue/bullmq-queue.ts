import { Queue } from 'bullmq';
import type { QueuePort } from './queue.port.js';

export class BullMqQueue implements QueuePort {
  private readonly queue: Queue;

  constructor(name: string, connection: { host: string; port: number }) {
    this.queue = new Queue(name, { connection });
  }

  async add(name: string, data: unknown) {
    await this.queue.add(name, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: 1000
    });
  }

  async close() {
    await this.queue.close();
  }
}
