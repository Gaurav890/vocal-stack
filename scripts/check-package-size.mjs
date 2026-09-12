import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const MAX_PACKED_BYTES = 150 * 1024;
const MAX_PRIMARY_GZIP_BYTES = 25 * 1024;

const packed = spawnSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: process.cwd(),
  encoding: 'utf8',
});
if (packed.status !== 0) throw new Error(packed.stderr || 'npm pack --dry-run failed');

const report = JSON.parse(packed.stdout)[0];
const packedBytes = report.size;
const gzipBytes = gzipSync(readFileSync(new URL('../dist/index.js', import.meta.url))).byteLength;

if (packedBytes > MAX_PACKED_BYTES) {
  throw new Error(`Packed package is ${packedBytes} bytes; limit is ${MAX_PACKED_BYTES} bytes`);
}
if (gzipBytes > MAX_PRIMARY_GZIP_BYTES) {
  throw new Error(
    `Primary ESM entry is ${gzipBytes} gzip bytes; limit is ${MAX_PRIMARY_GZIP_BYTES}`
  );
}

process.stdout.write(
  `package size: ${packedBytes} bytes packed, ${gzipBytes} bytes primary gzip\n`
);
