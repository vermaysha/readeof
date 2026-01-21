import { existsSync } from 'fs';
import { rm } from 'fs/promises';

try {
  if (existsSync('dist')) {
    console.log('🧹 Cleaning dist folder...');
    await rm('dist', { recursive: true, force: true });
  }

  // Build ESM
  console.log('📦 Building ESM...');
  await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    target: 'node',
    format: 'esm',
    naming: '[name].mjs',
  });

  // Build CommonJS
  console.log('📦 Building CommonJS...');
  await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    target: 'node',
    format: 'cjs',
    naming: '[name].js',
  });

  console.log('✅ Build completed!');

} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
