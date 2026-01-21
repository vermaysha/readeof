import { run, bench, group } from 'mitata';
import { readeof } from '../src/index.ts';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

// Configuration
const BENCHMARK_DIR = '/tmp/benchmark-files';
const FILE_CONFIGS = [
  { size: 'small', bytes: 10 * 1024, lineLength: 'short', chars: 50 },
  { size: 'small', bytes: 10 * 1024, lineLength: 'medium', chars: 200 },
  { size: 'small', bytes: 10 * 1024, lineLength: 'long', chars: 1000 },
  { size: 'medium', bytes: 1024 * 1024, lineLength: 'short', chars: 50 },
  { size: 'medium', bytes: 1024 * 1024, lineLength: 'medium', chars: 200 },
  { size: 'medium', bytes: 1024 * 1024, lineLength: 'long', chars: 1000 },
  { size: 'large', bytes: 100 * 1024 * 1024, lineLength: 'short', chars: 50 },
  { size: 'large', bytes: 100 * 1024 * 1024, lineLength: 'medium', chars: 200 },
  { size: 'large', bytes: 100 * 1024 * 1024, lineLength: 'long', chars: 1000 },
];

const BUFFER_SIZES = [
  { name: '4KB', bytes: 4 * 1024 },
  { name: '8KB', bytes: 8 * 1024 },
  { name: '16KB', bytes: 16 * 1024 },
  { name: '32KB', bytes: 32 * 1024 },
  { name: '64KB', bytes: 64 * 1024 },
];

const LINE_COUNTS = [10, 100, 1000];

// Generate test files
async function generateTestFiles() {
  console.log('Generating test files...');
  await mkdir(BENCHMARK_DIR, { recursive: true });

  for (const config of FILE_CONFIGS) {
    const filename = `${config.size}-${config.lineLength}.txt`;
    const filepath = join(BENCHMARK_DIR, filename);

    // Generate content
    const lineContent = 'a'.repeat(config.chars - 1); // -1 for newline
    const lineWithNewline = lineContent + '\n';
    const bytesPerLine = Buffer.byteLength(lineWithNewline);
    const totalLines = Math.ceil(config.bytes / bytesPerLine);

    let content = '';
    for (let i = 0; i < totalLines; i++) {
      content += lineWithNewline;
    }

    await Bun.write(filepath, content);
    console.log(`  Created: ${filename} (${(content.length / 1024 / 1024).toFixed(2)} MB, ${totalLines} lines)`);
  }

  console.log('Test files generated.\n');
}

// Tail helper using subprocess
function tailFile(filePath: string, lines: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('tail', ['-n', String(lines), filePath]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`tail process exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Run benchmarks
async function runBenchmarks() {
  await generateTestFiles();

  // Group by file size
  for (const size of ['small', 'medium', 'large']) {
    group(`File Size: ${size}`, () => {
      // Group by line length
      for (const lineLength of ['short', 'medium', 'long']) {
        const filename = `${size}-${lineLength}.txt`;
        const filepath = join(BENCHMARK_DIR, filename);

        group(`  Line Length: ${lineLength}`, () => {
          // Test different line counts
          for (const lineCount of LINE_COUNTS) {
            group(`    Reading ${lineCount} lines`, () => {
              // Benchmark readeof with different buffer sizes
              for (const bufferSize of BUFFER_SIZES) {
                bench(`readeof (${bufferSize.name})`, async () => {
                  await readeof(filepath, lineCount, 'utf8', bufferSize.bytes);
                });
              }

              // Benchmark tail command
              bench('tail (Linux)', async () => {
                await tailFile(filepath, lineCount);
              });
            });
          }
        });
      }
    });
  }

  await run();
}

// Main execution with cleanup
try {
  await runBenchmarks();
} finally {
  console.log('\nCleaning up test files...');
  await rm(BENCHMARK_DIR, { recursive: true, force: true });
  console.log('Cleanup complete.');
}
