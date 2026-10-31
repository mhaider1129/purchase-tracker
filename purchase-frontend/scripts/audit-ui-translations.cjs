#!/usr/bin/env node
// Development-only static inventory. Findings need review: technical identifiers,
// document codes and deliberately English content are not automatically errors.
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const root = path.resolve(__dirname, '../src');
const catalogue = require('../src/locales/interface.en.json');
const findings = [];
const missingMessages = [];
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { scan(file); continue; }
    if (!/\.jsx?$/.test(entry.name) || /\.(test|spec)\./.test(entry.name)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
    traverse(ast, {
      JSXText(p) {
        const text = p.node.value.replace(/\s+/g, ' ').trim();
        if (!/[A-Za-z]{2}/.test(text) || /^(CSV|PDF|RFID|IQD|USD|DEMO-|Open DEMO-)$/.test(text)) return;
        findings.push({ file: path.relative(root, file), line: p.node.loc.start.line, text });
      },
      CallExpression(p) {
        if (p.node.callee.name !== 'uiText' || p.node.arguments[0]?.type !== 'StringLiteral') return;
        const key = p.node.arguments[0].value;
        if (!Object.hasOwn(catalogue, key)) missingMessages.push({ file: path.relative(root, file), line: p.node.loc.start.line, key });
      },
    });
  }
}
scan(root);
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify({ missingMessages, remainingLiteralText: findings }, null, 2) + '\n');
} else {
  const counts = new Map();
  for (const item of findings) counts.set(item.file, (counts.get(item.file) || 0) + 1);
  console.log(`Missing interface catalogue messages: ${missingMessages.length}`);
  console.log(`Remaining literal JSX text candidates: ${findings.length} in ${counts.size} files (manual review required).`);
  for (const [file, count] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`${count}\t${file}`);
}
if (missingMessages.length) process.exitCode = 1;
