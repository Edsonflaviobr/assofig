import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/assofig'),
  JWT_SECRET: z.string().min(32).default('desenvolvimento-chave-local-assofig-12345'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5500,http://127.0.0.1:5500'),
  FRONTEND_URL: z.url().default('http://localhost:5500'),
  EMAIL_PROVIDER: z.enum(['disabled', 'resend']).default('disabled'),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.email().optional(),
  SEED_PASSWORD: z.string().min(6).max(200),
  PIX_KEY: z.string().default(''),
  PIX_RECEIVER_NAME: z.string().default('ASSOFIG')
}).superRefine((values, context) => {
  if (values.NODE_ENV !== 'production') return;

  for (const key of ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN'] as const) {
    if (!process.env[key]?.trim()) {
      context.addIssue({
        code: 'custom',
        path: [key],
        message: `${key} deve ser configurada no ambiente de produção.`
      });
    }
  }

  if (!process.env.FRONTEND_URL?.trim()) {
    context.addIssue({ code: 'custom', path: ['FRONTEND_URL'], message: 'FRONTEND_URL deve ser configurada no ambiente de produção.' });
  }
  if (values.EMAIL_PROVIDER !== 'resend') {
    context.addIssue({ code: 'custom', path: ['EMAIL_PROVIDER'], message: 'EMAIL_PROVIDER deve ser resend no ambiente de produção.' });
  }
  for (const key of ['RESEND_API_KEY', 'EMAIL_FROM'] as const) {
    if (!process.env[key]?.trim()) {
      context.addIssue({ code: 'custom', path: [key], message: key + ' deve ser configurada no ambiente de produção.' });
    }
  }
});

export const env = schema.parse(process.env);
