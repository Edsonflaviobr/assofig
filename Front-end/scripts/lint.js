const { readdirSync, readFileSync } = require('node:fs');
const { join, extname, relative } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(__dirname, '..');
const sourceRoots = ['js', 'scripts', 'tests'];
const files = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'vendor') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (extname(entry.name) === '.js') files.push(path);
  }
}

sourceRoots.forEach(directory => collect(join(root, directory)));

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  const source = readFileSync(file, 'utf8');
  if (/\bdebugger\s*;/.test(source) || /console\.log\s*\(/.test(source)) {
    throw new Error('Código de depuração encontrado em ' + relative(root, file));
  }
}

for (const htmlFile of ['index.html', 'reset-password.html', 'validar.html']) {
  const source = readFileSync(join(root, htmlFile), 'utf8');
  const ids = [...source.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) throw new Error('IDs duplicados em ' + htmlFile + ': ' + [...new Set(duplicates)].join(', '));
}

process.stdout.write('Lint concluído: ' + files.length + ' arquivos JavaScript e 3 páginas HTML verificados.\n');
