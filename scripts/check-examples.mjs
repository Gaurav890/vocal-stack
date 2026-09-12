import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(command, arguments_, cwd) {
  const result = spawnSync(command, arguments_, { cwd, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

const root = process.cwd();
const artifactDirectory = join(root, '.artifacts');
mkdirSync(artifactDirectory, { recursive: true });
const packed = spawnSync('npm', ['pack', '--json', '--pack-destination', artifactDirectory], {
  cwd: root,
  encoding: 'utf8',
});
if (packed.status !== 0) throw new Error(packed.stderr || 'Unable to pack vocal-stack');
const tarball = join(artifactDirectory, JSON.parse(packed.stdout)[0].filename);

for (const exampleRoot of ['examples', 'stackblitz-demos']) {
  for (const entry of readdirSync(join(root, exampleRoot), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(root, exampleRoot, entry.name);
    if (!readdirSync(directory).includes('package.json')) continue;
    run(
      'npm',
      [
        'install',
        '--no-save',
        '--package-lock=false',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        tarball,
      ],
      directory
    );
    for (const file of readdirSync(directory).filter((file) => file.endsWith('.js'))) {
      run(process.execPath, ['--check', file], directory);
    }
    if (exampleRoot === 'stackblitz-demos') run('npm', ['run', 'build'], directory);
  }
}

const typescript = join(root, 'node_modules', '.bin', 'tsc');
for (const entry of readdirSync(join(root, 'recipes'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = join(root, 'recipes', entry.name);
  if (!readdirSync(directory).includes('package.json')) continue;
  const isolatedDirectory = mkdtempSync(join(tmpdir(), `vocal-stack-${entry.name}-`));
  try {
    cpSync(directory, isolatedDirectory, {
      recursive: true,
      filter: (source) => !source.split('/').includes('node_modules'),
    });
    run(
      'npm',
      [
        'install',
        '--no-save',
        '--package-lock=false',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        tarball,
      ],
      isolatedDirectory
    );
    run(
      typescript,
      [
        '--noEmit',
        '--ignoreConfig',
        '--strict',
        '--skipLibCheck',
        '--target',
        'ES2022',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        '--lib',
        'ES2022,DOM',
        'index.ts',
      ],
      isolatedDirectory
    );
  } finally {
    rmSync(isolatedDirectory, { recursive: true, force: true });
  }
}

process.stdout.write('all examples and recipes passed against the packed artifact\n');
