import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(command, arguments_, cwd) {
  const result = spawnSync(command, arguments_, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
}

const directory = mkdtempSync(join(tmpdir(), 'vocal-stack-smoke-'));
try {
  const packReport = JSON.parse(
    run('npm', ['pack', process.cwd(), '--json', '--pack-destination', directory], process.cwd())
  )[0];
  const tarball = join(directory, packReport.filename);
  writeFileSync(join(directory, 'package.json'), '{"private":true,"type":"module"}\n');
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], directory);

  writeFileSync(
    join(directory, 'esm.mjs'),
    `import * as root from 'vocal-stack';
import * as sanitizer from 'vocal-stack/sanitizer';
import * as flow from 'vocal-stack/flow';
import * as monitor from 'vocal-stack/monitor';
import * as text from 'vocal-stack/text';
import * as turn from 'vocal-stack/turn';
import * as telemetry from 'vocal-stack/telemetry';
import * as testing from 'vocal-stack/testing';
const expected = [
  [root, 'createVoicePipeline'],
  [sanitizer, 'SpeechSanitizer'],
  [flow, 'FlowController'],
  [flow, 'FlowManager'],
  [monitor, 'VoiceAuditor'],
  [text, 'normalizeForSpeech'],
  [turn, 'createVoicePipeline'],
  [telemetry, 'MemoryTelemetrySink'],
  [testing, 'VirtualClock'],
];
for (const [module, name] of expected) {
  if (typeof module[name] !== 'function') throw new Error(\`Missing ESM export \${name}\`);
}
if (text.normalizeForSpeech('**ESM**.') !== 'ESM.') throw new Error('ESM import failed');
`
  );
  writeFileSync(
    join(directory, 'cjs.cjs'),
    `const modules = [
  [require('vocal-stack'), 'createVoicePipeline'],
  [require('vocal-stack/sanitizer'), 'SpeechSanitizer'],
  [require('vocal-stack/flow'), 'FlowController'],
  [require('vocal-stack/flow'), 'FlowManager'],
  [require('vocal-stack/monitor'), 'VoiceAuditor'],
  [require('vocal-stack/text'), 'normalizeForSpeech'],
  [require('vocal-stack/turn'), 'createVoicePipeline'],
  [require('vocal-stack/telemetry'), 'MemoryTelemetrySink'],
  [require('vocal-stack/testing'), 'VirtualClock'],
];
for (const [module, name] of modules) {
  if (typeof module[name] !== 'function') throw new Error(\`Missing CJS export \${name}\`);
}
const { normalizeForSpeech } = require('vocal-stack/text');
if (normalizeForSpeech('**CJS**.') !== 'CJS.') throw new Error('CJS import failed');
`
  );
  run(process.execPath, ['esm.mjs'], directory);
  run(process.execPath, ['cjs.cjs'], directory);

  const installedPackage = JSON.parse(
    readFileSync(join(directory, 'node_modules/vocal-stack/package.json'), 'utf8')
  );
  if (Object.keys(installedPackage.dependencies ?? {}).length !== 0) {
    throw new Error('Packed artifact contains runtime dependencies');
  }
  process.stdout.write('packed ESM and CJS consumers passed\n');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
