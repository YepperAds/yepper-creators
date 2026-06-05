import { Pool, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | undefined;

declare global {
  var pgPool: Pool | undefined;
}

function getPool() {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to connect to Postgres.');
  }

  pool = new Pool({ connectionString });

  if (process.env.NODE_ENV !== 'production') {
    global.pgPool = pool;
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}
