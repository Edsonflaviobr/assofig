import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/assofig'),
  JWT_SECRET: z.string().min(32).default('desenvolvimento-chave-local-assofig-12345'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5500,http://127.0.0.1:5500')
});

export const env = schema.parse(process.env);
