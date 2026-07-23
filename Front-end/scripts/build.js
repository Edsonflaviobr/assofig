const { existsSync, readFileSync } = require('node:fs');
const { dirname, join, normalize } = require('node:path');

const root = join(__dirname, '..');
const pages = ['index.html', 'reset-password.html', 'validar.html'];
const missing = [];

for (const page of pages) {
  const pagePath = join(root, page);
  if (!existsSync(pagePath)) {
    missing.push(page);
    continue;
  }
  const source = readFileSync(pagePath, 'utf8');
  for (const match of source.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
    const reference = match[1].split(/[?#]/)[0];
    if (!reference || reference.startsWith('http') || reference.startsWith('mailto:') ||
      reference.startsWith('/') || reference.startsWith('#')) continue;
    const target = normalize(join(dirname(pagePath), reference));
    if (!existsSync(target)) missing.push(page + ' -> ' + reference);
  }
}

for (const image of ['img/frente.png', 'img/verso.png', 'img/certificado.png']) {
  if (!existsSync(join(root, image))) missing.push(image);
}

const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : [];
for (const route of ['/reset-password', '/validar']) {
  const rewrite = rewrites.find(item => item.source === route);
  if (!rewrite) missing.push('rewrite ' + route);
  else if (!existsSync(join(root, rewrite.destination.replace(/^\//, '')))) missing.push(rewrite.destination);
}

if (missing.length) {
  throw new Error('Build estático inválido. Referências ausentes:\n- ' + missing.join('\n- '));
}

process.stdout.write('Build estático validado: páginas, rotas, scripts, estilos, documentos e artes estão presentes.\n');
