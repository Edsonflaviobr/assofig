const test = require('node:test');
const assert = require('node:assert/strict');
const credentials = require('../js/credentials.js');

test('cadastro antigo recebe estado disponível para emissão', () => {
  const value = credentials.normalizeCredential({ disponivel: false });
  assert.equal(value.available, false);
  assert.equal(credentials.credentialLabels(credentials.credentialTypeFor({ profession: 'Fisioterapeuta' }, value)).issue, 'Emitir carteira');
});

test('fisioterapeuta recebe carteira', () => {
  assert.equal(credentials.credentialTypeFor({ profession: 'Fisioterapeuta' }, {}), 'carteira');
});

test('terapeuta ocupacional recebe carteira', () => {
  assert.equal(credentials.credentialTypeFor({ profession: 'Terapeuta Ocupacional' }, {}), 'carteira');
});

test('estudante recebe carteira', () => {
  assert.equal(credentials.credentialTypeFor({ profession: 'Estudante' }, {}), 'carteira');
});

test('empresa recebe exclusivamente certificado', () => {
  const type = credentials.credentialTypeFor({ profession: 'Empresa' }, {});
  assert.equal(type, 'certificado');
  assert.equal(credentials.credentialLabels(type).issue, 'Emitir certificado');
  assert.notEqual(credentials.credentialLabels(type).issue, 'Emitir carteira');
});

test('tipo retornado pelo backend prevalece sobre o texto do perfil', () => {
  assert.equal(credentials.credentialTypeFor({ profession: 'Empresa' }, { type: 'carteira' }), 'carteira');
});

test('normaliza resposta emitida sem alterar nome e código', () => {
  const value = credentials.normalizeCredential({
    disponivel: true,
    tipoCredencial: 'carteira',
    nomeExibicao: 'Edson Sousa',
    categoriaExibicao: 'Terapeuta Ocupacional',
    validadeAno: 2027,
    codigoVerificacao: 'AS4K-82PZ',
    status: 'disponivel'
  });
  assert.deepEqual(value, {
    available: true,
    type: 'carteira',
    displayName: 'Edson Sousa',
    category: 'Terapeuta Ocupacional',
    validityYear: 2027,
    verificationCode: 'AS4K-82PZ',
    status: 'disponivel'
  });
});

test('preserva nome empresarial completo no certificado', () => {
  const value = credentials.normalizeCredential({
    disponivel: true,
    tipoCredencial: 'certificado',
    nomeExibicao: 'Empresa Exemplo Ltda.',
    categoriaExibicao: 'Empresa',
    codigoVerificacao: 'BG7M-4PZX'
  });
  assert.equal(value.displayName, 'Empresa Exemplo Ltda.');
});

test('aceita e formata código com ou sem hífen e em minúsculas', () => {
  assert.equal(credentials.normalizeVerificationInput('AS4K-82PZ'), 'AS4K-82PZ');
  assert.equal(credentials.normalizeVerificationInput('AS4K82PZ'), 'AS4K-82PZ');
  assert.equal(credentials.normalizeVerificationInput(' as4k - 82pz '), 'AS4K-82PZ');
  assert.equal(credentials.isVerificationCode('as4k82pz'), true);
});

test('rejeita código público incompleto', () => {
  assert.equal(credentials.isVerificationCode('AS4K-82'), false);
});

test('normaliza resultado público de carteira válida', () => {
  const value = credentials.normalizeValidationResult({
    encontrada: true,
    valida: true,
    tipoCredencial: 'carteira',
    nome: 'Edson Sousa',
    categoria: 'Terapeuta Ocupacional',
    situacao: 'Ativo',
    validadeAno: 2027
  });
  assert.equal(value.valid, true);
  assert.equal(credentials.credentialLabels(value.type).validTitle, 'Carteira válida');
  assert.equal(value.category, 'Terapeuta Ocupacional');
});

test('normaliza resultado público de certificado válido', () => {
  const value = credentials.normalizeValidationResult({
    encontrada: true,
    valida: true,
    tipoCredencial: 'certificado',
    nome: 'Empresa Exemplo Ltda.',
    categoria: 'Empresa',
    situacao: 'Ativa',
    validadeAno: 2027
  });
  assert.equal(value.valid, true);
  assert.equal(credentials.credentialLabels(value.type).validTitle, 'Certificado válido');
  assert.equal(credentials.credentialLabels(value.type).entityLabel, 'Empresa');
});

test('normaliza resultado inexistente sem inventar dados', () => {
  const value = credentials.normalizeValidationResult({
    encontrada: false,
    valida: false,
    mensagem: 'Credencial não localizada.'
  });
  assert.equal(value.found, false);
  assert.equal(value.name, '');
  assert.equal(value.message, 'Credencial não localizada.');
});

test('preserva mensagens de suspensão e vencimento', () => {
  const suspended = credentials.normalizeValidationResult({
    encontrada: true, valida: false, situacao: 'Suspensa',
    mensagem: 'Esta credencial está temporariamente suspensa.'
  });
  const expired = credentials.normalizeValidationResult({
    encontrada: true, valida: false, situacao: 'Vencida',
    mensagem: 'Esta credencial está vencida.'
  });
  assert.match(suspended.message, /temporariamente suspensa/);
  assert.match(expired.message, /está vencida/);
});

test('reduz progressivamente nome longo sem modificar seu valor', () => {
  const name = 'Empresa de Fisioterapia e Terapia Ocupacional Exemplo Ltda.';
  const scale = credentials.fitScale(name, 42, 0.46);
  assert.ok(scale < 1);
  assert.equal(name, 'Empresa de Fisioterapia e Terapia Ocupacional Exemplo Ltda.');
});

test('plano de PDF da carteira contém frente e verso', () => {
  assert.deepEqual(credentials.pdfPlan({ type: 'carteira' }), {
    filename: 'carteira-assofig.pdf',
    pages: ['frente', 'verso']
  });
});

test('plano de PDF do certificado contém somente certificado', () => {
  assert.deepEqual(credentials.pdfPlan({ type: 'certificado' }), {
    filename: 'certificado-associacao-assofig.pdf',
    pages: ['certificado']
  });
});
