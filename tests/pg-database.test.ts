import pg from 'pg';
import { PgDatabase } from '../src/shared/database/pg-database.js';

describe('PgDatabase', () => {
  it('handles idle pool errors so failover connection drops do not crash the process', async () => {
    const onSpy = vi.spyOn(pg.Pool.prototype, 'on');
    const database = new PgDatabase('postgresql://user:pass@localhost:5432/app');

    expect(onSpy).toHaveBeenCalledWith('error', expect.any(Function));

    await database.close();
    onSpy.mockRestore();
  });
});
