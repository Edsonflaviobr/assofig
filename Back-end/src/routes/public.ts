import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { emailSchema } from '../schemas/common.js';
import { documentSchema, readDocumentInput } from '../utils/document.js';

export const publicRouter = Router();

const applicationSchema = z.object({
  name: z.string().trim().min(3).max(160),
  profession: z.string().trim().min(2).max(100),
  email: emailSchema,
  document: documentSchema,
  phone: z.string().trim().min(8).max(30),
  registry: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2).max(120)
});

const contactSchema = z.object({
  name: z.string().trim().min(3).max(160),
  email: emailSchema,
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(5).max(5000)
});

publicRouter.post('/inscricoes', async (req, res) => {
  const input = applicationSchema.parse({ ...req.body, document: readDocumentInput(req.body) });
  const result = await pool.query(
    `INSERT INTO inscricoes (name,profession,email,document,phone,registry,city)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,status`,
    [input.name, input.profession, input.email, input.document, input.phone, input.registry ?? null, input.city]);
  res.status(201).json(result.rows[0]);
});

publicRouter.post('/contato', async (req, res) => {
  const input = contactSchema.parse(req.body);
  await pool.query('INSERT INTO contatos (name,email,subject,message) VALUES ($1,$2,$3,$4)',
    [input.name, input.email, input.subject, input.message]);
  res.status(201).json({ sent: true });
});

publicRouter.get('/noticias', (_req, res) => res.json([]));
publicRouter.get('/eventos', (_req, res) => res.json([]));
