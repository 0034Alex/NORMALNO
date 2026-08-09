const fs = require('fs');
const path = require('path');
const vm = require('vm');

let hasError = false;
let checkedCount = 0;

function checkJsSource(label, source) {
  checkedCount++;
  try {
    new vm.Script(source, { filename: label });
  } catch (e) {
    hasError = true;
    console.error(`\n❌ Синтаксична помилка: ${label}`);
    console.error(`   ${e.message}`);
  }
}

function extractInlineScripts(html) {
  const scripts = [];
  const regex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  return scripts;
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'scripts']);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith('.js')) {
      const source = fs.readFileSync(fullPath, 'utf8');
      checkJsSource(fullPath, source);
    } else if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(fullPath, 'utf8');
      const scripts = extractInlineScripts(html);
      scripts.forEach((s, i) => {
        if (s.trim()) checkJsSource(`${fullPath} (script #${i + 1})`, s);
      });
    }
  }
}

walk('.');

console.log(`\nПеревірено файлів/блоків коду: ${checkedCount}`);

if (hasError) {
  console.error('\n🔴 Знайдено синтаксичні помилки — див. вище.');
  process.exit(1);
} else {
  console.log('✅ Всі файли пройшли перевірку синтаксису.');
}
