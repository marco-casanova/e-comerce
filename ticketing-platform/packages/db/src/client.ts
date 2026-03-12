import { Pool } from 'pg';

import { loadEnvFile } from './dotenv';

loadEnvFile();

const connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/ticketing';

export const pool = new Pool({
  connectionString
});
