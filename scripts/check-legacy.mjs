import { parse } from 'acorn';
import { readFileSync } from 'node:fs';
for (const file of ['public/app.js', 'public/memory-core.js', 'public/voice.js']) { parse(readFileSync(file, 'utf8'), { ecmaVersion: 5, sourceType: 'script' }); console.log('PASS: ES5 syntax ' + file); }
// Syntax checking cannot emulate Android 4.4 TLS, browser APIs or hardware.
