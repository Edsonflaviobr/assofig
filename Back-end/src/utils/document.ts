import { z } from 'zod';

export type DocumentType = 'cpf' | 'cnpj';

export function normalizeDocument(value: string): string {
  return value.replace(/\D/g, '');
}

function hasRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function calculateDigit(base: string, weights: number[]): number {
  const sum = base.split('').reduce((total, digit, index) => total + Number(digit) * weights[index]!, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeDocument(value);
  if (cpf.length !== 11 || hasRepeatedDigits(cpf)) return false;
  const first = calculateDigit(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(cpf.slice(0, 9) + first, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cpf.endsWith(`${first}${second}`);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeDocument(value);
  if (cnpj.length !== 14 || hasRepeatedDigits(cnpj)) return false;
  const first = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${first}${second}`);
}

export function getDocumentType(value: string): DocumentType | null {
  const document = normalizeDocument(value);
  if (isValidCpf(document)) return 'cpf';
  if (isValidCnpj(document)) return 'cnpj';
  return null;
}

export const documentSchema = z.string()
  .trim()
  .transform(normalizeDocument)
  .refine((value) => getDocumentType(value) !== null, 'CPF ou CNPJ inválido.');

export function readDocumentInput(input: Record<string, unknown>): unknown {
  return input.document ?? input.cpfCnpj ?? input.cpf ?? input.cnpj;
}
