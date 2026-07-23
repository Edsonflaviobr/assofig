import { randomInt } from 'node:crypto';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { transaction } from '../db/transaction.js';
import { ApiError } from '../utils/api-error.js';

export type CredentialType = 'carteira' | 'certificado';
export type CredentialStatus = 'disponivel' | 'suspensa' | 'vencida';

type CategoryMapping = {
  credentialType: CredentialType;
  publicCategory: 'Fisioterapeuta' | 'Terapeuta Ocupacional' | 'Estudante' | 'Empresa';
  company: boolean;
};

type CredentialRow = {
  name: string;
  profession: string;
  tipo_credencial: CredentialType | null;
  codigo_verificacao_credencial: string | null;
  status_credencial: CredentialStatus | null;
  data_emissao_credencial: string | Date | null;
  validade_credencial: string | Date | null;
  credential_expired: boolean;
};

const VERIFICATION_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const VERIFICATION_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;
const MAX_CODE_ATTEMPTS = 8;

const credentialColumns = `
  name, profession, tipo_credencial, codigo_verificacao_credencial,
  status_credencial, data_emissao_credencial, validade_credencial,
  COALESCE(
    validade_credencial < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date,
    FALSE
  ) AS credential_expired`;

function normalizeCategoryValue(value: string): string {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function mapCredentialCategory(value: string): CategoryMapping {
  const normalized = normalizeCategoryValue(value);
  const compact = normalized.replace(/\s/g, '');

  if (normalized.includes('empresa') || normalized.includes('pessoa juridica') || normalized.includes('cnpj')) {
    return { credentialType: 'certificado', publicCategory: 'Empresa', company: true };
  }
  if (normalized.includes('estudante') || normalized.includes('academico')) {
    return { credentialType: 'carteira', publicCategory: 'Estudante', company: false };
  }
  if (
    normalized === 'to' || normalized.includes('terapeuta ocupacional') ||
    compact.includes('profissionalto') || compact === 'terapiaocupacional'
  ) {
    return { credentialType: 'carteira', publicCategory: 'Terapeuta Ocupacional', company: false };
  }
  if (
    normalized.includes('fisioterapeuta') || normalized.includes('fisioterapia') ||
    compact.includes('profissionalfisio')
  ) {
    return { credentialType: 'carteira', publicCategory: 'Fisioterapeuta', company: false };
  }

  throw new ApiError(422, 'Categoria do associado não reconhecida para emissão da credencial.');
}

export function credentialDisplayName(name: string, company: boolean): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (company || parts.length <= 1) return parts.join(' ');
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function generateVerificationCode(): string {
  const raw = Array.from({ length: 8 }, () => VERIFICATION_ALPHABET[randomInt(VERIFICATION_ALPHABET.length)]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function normalizeVerificationCode(value: string): string | null {
  const raw = value.replace(/[\s-]/g, '').toUpperCase();
  if (!VERIFICATION_PATTERN.test(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function validityYear(value: string | Date | null): number | null {
  if (!value) return null;
  const year = Number(value instanceof Date ? value.toISOString().slice(0, 4) : String(value).slice(0, 4));
  return Number.isInteger(year) ? year : null;
}

function effectiveStatus(row: CredentialRow): CredentialStatus {
  if (row.status_credencial === 'suspensa') return 'suspensa';
  if (row.status_credencial === 'vencida' || row.credential_expired) return 'vencida';
  return 'disponivel';
}

function ownCredentialResponse(row: CredentialRow) {
  const category = mapCredentialCategory(row.profession);
  return {
    disponivel: true,
    tipoCredencial: row.tipo_credencial ?? category.credentialType,
    nomeExibicao: credentialDisplayName(row.name, category.company),
    categoriaExibicao: category.publicCategory,
    validadeAno: validityYear(row.validade_credencial),
    codigoVerificacao: row.codigo_verificacao_credencial,
    status: effectiveStatus(row)
  };
}

export async function getOwnCredential(associadoId: number) {
  const result = await pool.query(
    `SELECT ${credentialColumns} FROM associados WHERE id=$1`,
    [associadoId]
  );
  if (!result.rowCount) throw new ApiError(404, 'Associado não encontrado.');
  const row = result.rows[0] as CredentialRow;
  if (!row.codigo_verificacao_credencial) return { disponivel: false };
  return ownCredentialResponse(row);
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === '23505';
}

export async function issueOwnCredential(associadoId: number) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    try {
      return await transaction(async (client) => {
        const current = await client.query(
          `SELECT ${credentialColumns} FROM associados WHERE id=$1 FOR UPDATE`,
          [associadoId]
        );
        if (!current.rowCount) throw new ApiError(404, 'Associado não encontrado.');
        const row = current.rows[0] as CredentialRow;
        if (row.codigo_verificacao_credencial) return ownCredentialResponse(row);

        const category = mapCredentialCategory(row.profession);
        const code = generateVerificationCode();
        const updated = await client.query(
          `UPDATE associados
           SET tipo_credencial=$2,
               codigo_verificacao_credencial=$3,
               status_credencial='disponivel',
               data_emissao_credencial=NOW(),
               validade_credencial=$4,
               updated_at=NOW()
           WHERE id=$1 AND codigo_verificacao_credencial IS NULL
           RETURNING ${credentialColumns}`,
          [associadoId, category.credentialType, code, env.CREDENTIAL_VALID_UNTIL ?? null]
        );
        if (!updated.rowCount) throw new ApiError(409, 'Não foi possível concluir a emissão da credencial.');
        return ownCredentialResponse(updated.rows[0] as CredentialRow);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        if (attempt + 1 < MAX_CODE_ATTEMPTS) continue;
        throw new ApiError(503, 'Não foi possível gerar um código de verificação único. Tente novamente.');
      }
      throw error;
    }
  }
  throw new ApiError(503, 'Não foi possível gerar um código de verificação único. Tente novamente.');
}

export async function validatePublicCredential(codeInput: string) {
  const code = normalizeVerificationCode(codeInput);
  if (!code) return { encontrada: false, valida: false, mensagem: 'Credencial não localizada.' };

  const result = await pool.query(
    `SELECT ${credentialColumns}
     FROM associados
     WHERE codigo_verificacao_credencial=$1`,
    [code]
  );
  if (!result.rowCount) return { encontrada: false, valida: false, mensagem: 'Credencial não localizada.' };

  const row = result.rows[0] as CredentialRow;
  const category = mapCredentialCategory(row.profession);
  const status = effectiveStatus(row);
  const type = row.tipo_credencial ?? category.credentialType;
  const base = {
    encontrada: true,
    valida: status === 'disponivel',
    tipoCredencial: type,
    nome: credentialDisplayName(row.name, category.company),
    categoria: category.publicCategory,
    situacao: status === 'disponivel' ? (type === 'certificado' ? 'Ativa' : 'Ativo') : status === 'suspensa' ? 'Suspensa' : 'Vencida',
    validadeAno: validityYear(row.validade_credencial)
  };
  if (status === 'suspensa') return { ...base, mensagem: 'Esta credencial está temporariamente suspensa.' };
  if (status === 'vencida') return { ...base, mensagem: 'Esta credencial está vencida.' };
  return base;
}
