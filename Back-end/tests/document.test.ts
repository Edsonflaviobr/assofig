import { describe, expect, it } from 'vitest';
import { documentSchema, getDocumentType, isValidCnpj, isValidCpf, normalizeDocument } from '../src/utils/document.js';

describe('CPF e CNPJ', () => {
  it('normaliza e valida CPF formatado', () => {
    expect(normalizeDocument('119.953.656-37')).toBe('11995365637');
    expect(isValidCpf('119.953.656-37')).toBe(true);
    expect(getDocumentType('119.953.656-37')).toBe('cpf');
  });

  it('valida CNPJ formatado', () => {
    expect(isValidCnpj('11.444.777/0001-61')).toBe(true);
    expect(documentSchema.parse('11.444.777/0001-61')).toBe('11444777000161');
    expect(getDocumentType('11.444.777/0001-61')).toBe('cnpj');
  });

  it('rejeita dígitos verificadores incorretos e sequências repetidas', () => {
    expect(isValidCpf('119.953.656-38')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCnpj('11.444.777/0001-62')).toBe(false);
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false);
  });
});
