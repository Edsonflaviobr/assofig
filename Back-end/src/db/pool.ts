import pg from 'pg';
import { env } from '../config/env.js';

pg.types.setTypeParser(20, Number);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});
