import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import type { SqlDatabase } from './database.port.js';

const { Pool } = pg;

export class PgDatabase implements SqlDatabase {
  private readonly pool: pg.Pool;
  private readonly transactionClient = new AsyncLocalStorage<pg.PoolClient>();

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
    this.pool.on('error', () => {
      // The pool can emit idle client errors when Pgpool/repmgr drops old
      // connections during failover. Queries get fresh clients on demand.
    });
  }

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []) {
    const client = this.transactionClient.getStore();
    return client ? client.query<T>(text, values) : this.pool.query<T>(text, values);
  }

  async healthCheck() {
    await this.pool.query('SELECT 1');
  }

  async transaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.transactionClient.run(client, () => work(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}
