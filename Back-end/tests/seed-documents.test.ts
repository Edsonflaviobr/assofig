import { describe, expect, it } from 'vitest';
import { isValidCpf } from '../src/utils/document.js';

const cpfs = [
  '119.953.656-37', '081.355.436-54', '079.757.116-75',
  '106.756.406-36', '051.893.686-45',
  '079.839.526-51', '046.759.536-46', '040.600.906-62',
  '302.093.608-01', '223.453.778-95', '081.492.616-99',
  '042.021.066-01'
];

describe('documentos dos associados iniciais', () => {
  it('rejeita o CPF inconsistente informado para Marcella', () => {
    expect(isValidCpf('016.493.446-17')).toBe(false);
  });

  it.each(cpfs)('aceita o CPF %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });
});
