import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readeof } from '../src';

const TEST_DIR = join(import.meta.dir, '__test_files__');

beforeAll(async () => {
  await mkdir(TEST_DIR, { recursive: true });
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('readeof', () => {
  describe('basic functionality', () => {
    test('should read last N lines from a file', async () => {
      const filePath = join(TEST_DIR, 'basic.txt');
      const content = 'line 1\nline 2\nline 3\nline 4\nline 5';
      await writeFile(filePath, content);

      const result = await readeof(filePath, 3);
      expect(result).toBe('line 3\nline 4\nline 5');
    });

    test('should read all lines if maxLines is greater than total lines', async () => {
      const filePath = join(TEST_DIR, 'all-lines.txt');
      const content = 'line 1\nline 2\nline 3';
      await writeFile(filePath, content);

      const result = await readeof(filePath, 10);
      expect(result).toBe(content);
    });

    test('should handle single line file', async () => {
      const filePath = join(TEST_DIR, 'single-line.txt');
      const content = 'single line';
      await writeFile(filePath, content);

      const result = await readeof(filePath, 1);
      expect(result).toBe(content);
    });

    test('should read last line correctly', async () => {
      const filePath = join(TEST_DIR, 'last-one.txt');
      const content = 'line 1\nline 2\nline 3';
      await writeFile(filePath, content);

      const result = await readeof(filePath, 1);
      expect(result).toBe('line 3');
    });
  });

  describe('edge cases', () => {
    test('should return empty string for maxLines <= 0', async () => {
      const filePath = join(TEST_DIR, 'zero-lines.txt');
      await writeFile(filePath, 'line 1\nline 2');

      expect(await readeof(filePath, 0)).toBe('');
      expect(await readeof(filePath, -1)).toBe('');
    });

    test('should return empty string for empty file', async () => {
      const filePath = join(TEST_DIR, 'empty.txt');
      await writeFile(filePath, '');

      const result = await readeof(filePath, 5);
      expect(result).toBe('');
    });

    test('should handle file with trailing newline', async () => {
      const filePath = join(TEST_DIR, 'trailing-newline.txt');
      const content = 'line 1\nline 2\nline 3\n';
      await writeFile(filePath, content);

      const result = await readeof(filePath, 2);
      expect(result).toBe('line 2\nline 3\n');
    });

    test('should handle file with only newlines', async () => {
      const filePath = join(TEST_DIR, 'only-newlines.txt');
      const content = '\n\n\n';
      await writeFile(filePath, content);

      const result = await readeof(filePath, 2);
      expect(result).toBe('\n\n');
    });

    test('should handle file without trailing newline', async () => {
      const filePath = join(TEST_DIR, 'no-trailing-newline.txt');
      const content = 'line 1\nline 2\nline 3';
      await writeFile(filePath, content);

      const result = await readeof(filePath, 2);
      expect(result).toBe('line 2\nline 3');
    });
  });

  describe('large files', () => {
    test('should handle large files with small buffer', async () => {
      const filePath = join(TEST_DIR, 'large-file.txt');
      const lines = Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');
      await writeFile(filePath, content);

      const result = await readeof(filePath, 10, 'utf8', 64);
      const expectedLines = lines.slice(-10);
      expect(result).toBe(expectedLines.join('\n'));
    });

    test('should handle reading with different buffer sizes', async () => {
      const filePath = join(TEST_DIR, 'buffer-test.txt');
      const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');
      await writeFile(filePath, content);

      const result1 = await readeof(filePath, 5, 'utf8', 64);
      const result2 = await readeof(filePath, 5, 'utf8', 1024);
      const result3 = await readeof(filePath, 5, 'utf8', 16 * 1024);

      const expected = lines.slice(-5).join('\n');
      expect(result1).toBe(expected);
      expect(result2).toBe(expected);
      expect(result3).toBe(expected);
    });

    test('should handle very long lines', async () => {
      const filePath = join(TEST_DIR, 'long-lines.txt');
      const longLine = 'x'.repeat(10000);
      const content = `short line\n${longLine}\nanother short line`;
      await writeFile(filePath, content);

      const result = await readeof(filePath, 2);
      expect(result).toBe(`${longLine}\nanother short line`);
    });
  });

  describe('different encodings', () => {
    test('should handle utf8 encoding (default)', async () => {
      const filePath = join(TEST_DIR, 'utf8.txt');
      const content = 'Hello 世界\nBună ziua\n你好';
      await writeFile(filePath, content, 'utf8');

      const result = await readeof(filePath, 2, 'utf8');
      expect(result).toBe('Bună ziua\n你好');
    });

    test('should handle ascii encoding', async () => {
      const filePath = join(TEST_DIR, 'ascii.txt');
      const content = 'line 1\nline 2\nline 3';
      await writeFile(filePath, content, 'ascii');

      const result = await readeof(filePath, 2, 'ascii');
      expect(result).toBe('line 2\nline 3');
    });
  });

  describe('error handling', () => {
    test('should throw error for non-existent file', async () => {
      const filePath = join(TEST_DIR, 'non-existent.txt');

      await expect(readeof(filePath, 5)).rejects.toThrow();
    });

    test('should throw error for directory instead of file', async () => {
      const dirPath = join(TEST_DIR, 'test-dir');
      await mkdir(dirPath, { recursive: true });

      await expect(readeof(dirPath, 5)).rejects.toThrow();
    });

    test('should throw error for invalid path', async () => {
      await expect(readeof('', 5)).rejects.toThrow();
    });
  });

  describe('special characters', () => {
    test('should handle files with special characters', async () => {
      const filePath = join(TEST_DIR, 'special-chars.txt');
      const content = 'line with\ttabs\nline with    spaces\nline with émojis 🚀\n';
      await writeFile(filePath, content);

      const result = await readeof(filePath, 2);
      expect(result).toBe('line with    spaces\nline with émojis 🚀\n');
    });

    test('should handle carriage returns', async () => {
      const filePath = join(TEST_DIR, 'crlf.txt');
      const content = 'line 1\r\nline 2\r\nline 3\r\n';
      await writeFile(filePath, content);

      const result = await readeof(filePath, 2);
      expect(result).toContain('line 2');
      expect(result).toContain('line 3');
    });
  });

  describe('performance scenarios', () => {
    test('should efficiently read from end of very large file', async () => {
      const filePath = join(TEST_DIR, 'perf-large.txt');
      const lines = Array.from({ length: 10000 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');
      await writeFile(filePath, content);

      const startTime = performance.now();
      const result = await readeof(filePath, 5);
      const endTime = performance.now();

      expect(result).toBe(lines.slice(-5).join('\n'));
      // Should complete reasonably fast (less than 100ms for this size)
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should handle multiple consecutive reads', async () => {
      const filePath = join(TEST_DIR, 'multi-read.txt');
      const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');
      await writeFile(filePath, content);

      const result1 = await readeof(filePath, 10);
      const result2 = await readeof(filePath, 5);
      const result3 = await readeof(filePath, 1);

      expect(result1).toBe(lines.slice(-10).join('\n'));
      expect(result2).toBe(lines.slice(-5).join('\n'));
      expect(result3).toBe(lines.slice(-1).join('\n'));
    });
  });
});
