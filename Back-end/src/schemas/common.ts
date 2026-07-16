import { z } from 'zod';

export const idSchema = z.coerce.number().int().positive();
export const moneySchema = z.coerce.number().positive().max(1_000_000);
export const emailSchema = z.string().trim().toLowerCase().email().max(255);
export const dateSchema = z.iso.date();
