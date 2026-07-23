const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const credentials = require('../js/credentials.js');

const root = join(__dirname, '..');

test('as três artes definitivas existem nos caminhos esperados', () => {
  for (const path of ['img/frente.png', 'img/verso.png', 'img/certificado.png']) {
    assert.equal(existsSync(join(root, path)), true, path);
  }
});

test('página principal carrega PDF e credenciais antes do script principal', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const pdf = html.indexOf('js/vendor/jspdf.umd.min.js');
  const credentialsModule = html.indexOf('js/credentials.js');
  const main = html.indexOf('js/script.js');
  assert.ok(pdf >= 0 && credentialsModule > pdf && main > credentialsModule);
});

test('seção de contato contém o canal oficial do YouTube', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(html, /href="https:\/\/www\.youtube\.com\/channel\/UCiGkJ6oDy-9d0ZE44BpEebQ"/);
  assert.match(html, /<small>YouTube<\/small><strong>Canal ASSOFIG<\/strong>/);
});
test('rota pública /validar aponta para a página existente', () => {
  const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
  assert.ok(config.rewrites.some(item => item.source === '/validar' && item.destination === '/validar.html'));
  assert.equal(existsSync(join(root, 'validar.html')), true);
});

test('cliente HTTP contém somente os endpoints públicos e autenticados esperados', () => {
  const api = readFileSync(join(root, 'js/api.js'), 'utf8');
  assert.match(api, /myCredential:\s*'\/minha-credencial'/);
  assert.match(api, /validateCredential:\s*'\/credenciais\/validar'/);
  assert.match(api, /issueMyCredential/);
  assert.match(api, /skipAuth:\s*true/);
});

test('cadastro administrativo classifica associados por categoria e inclui empresa', () => {
  const script = readFileSync(join(root, 'js/script.js'), 'utf8');
  assert.match(script, /\{ name: 'profession', label: 'Categoria', type: 'profession'/);
  assert.match(script, /const options = \['Fisioterapeuta', 'Terapeuta Ocupacional', 'Estudante', 'Empresa'\]/);
  assert.match(script, /<th>Categoria<\/th>/);
});
test('frente da carteira não possui campos de documento ou identificação interna', () => {
  const fields = Object.keys(credentials.TEMPLATE_SPECS.frente.fields);
  assert.deepEqual(fields.sort(), ['category', 'name', 'validity']);
  assert.equal(fields.includes('document'), false);
  assert.equal(fields.includes('id'), false);
});

test('verso e certificado possuem campo para o código público', () => {
  assert.ok(credentials.TEMPLATE_SPECS.verso.fields.code);
  assert.ok(credentials.TEMPLATE_SPECS.certificado.fields.code);
  assert.ok(credentials.TEMPLATE_SPECS.certificado.fields.name);
  assert.ok(credentials.TEMPLATE_SPECS.certificado.fields.validity);
});
