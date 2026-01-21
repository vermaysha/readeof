import { open, type FileHandle } from 'node:fs/promises';

/**
 * Reads the last N lines from a file efficiently.
 *
 * @param filePath - Path to the file to read from
 * @param maxLines - Total lines to read from the end of the file
 * @param encoding - File encoding (default: 'utf8')
 *                   Available encodings: https://nodejs.org/api/buffer.html#buffers-and-character-encodings
 * @param bufferSize - Buffer size to use when reading the file (default: 16KB)
 *                     A larger buffer size may improve performance for large files.
 * @returns A promise that resolves to a string containing the last N lines of the file
 */
export async function readeof(
  /**
   * Path to the file to read from
   */
  filePath: string,

  /**
   * Total lines to read from the end of the file
   */
  maxLines: number,

  /**
   * File encoding (default: 'utf8')
   *
   * Available encodings: https://nodejs.org/api/buffer.html#buffers-and-character-encodings
   */
  encoding: BufferEncoding = 'utf8',

  /**
   * Buffer size to use when reading the file (default: 16KB)
   *
   * A larger buffer size may improve performance for large files.
   */
  bufferSize: number = 16 * 1024,
): Promise<string> {
  if (maxLines <= 0) return '';

  let fileHandle: FileHandle | null = null;

  try {
    fileHandle = await open(filePath, 'r');
    const stat = await fileHandle.stat();

    if (stat.size === 0) return '';

    const buffer = Buffer.alloc(bufferSize);
    let linesFound = 0;
    let position = stat.size;
    let startReadPos = stat.size;

    while (position > 0 && linesFound < maxLines) {
      const readLength = Math.min(bufferSize, position);
      position -= readLength;

      const result = await fileHandle.read(buffer, 0, readLength, position);
      const bytesRead = result.bytesRead;

      for (let i = bytesRead - 1; i >= 0; i--) {
        if (buffer[i] === 10) {

          // dont count the very last newline in the last position
          if (position + i !== stat.size - 1 || linesFound > 0) {
            linesFound++;
          }

          if (linesFound >= maxLines) {
            startReadPos = position + i + 1;
            break;
          }
        }
      }
    }

    if (linesFound < maxLines) {
      startReadPos = 0;
    }

    const lengthToRead = stat.size - startReadPos;
    const resultBuffer = Buffer.alloc(lengthToRead);

    await fileHandle.read(resultBuffer, 0, lengthToRead, startReadPos);

    return resultBuffer.toString(encoding);

  } catch (error) {
    throw error;
  } finally {
    console.log('Closing file handle');
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}
