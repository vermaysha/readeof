import { open, type FileHandle } from 'node:fs/promises';

/**
 * Options for reading the file
 */
export interface ReadOptions {
  /**
   * File encoding (default: 'utf8')
   *
   * Available encodings: https://nodejs.org/api/buffer.html#buffers-and-character-encodings
   */
  encoding?: BufferEncoding;

  /**
   * Buffer size to use when reading the file (default: 16KB)
   *
   * A larger buffer size may improve performance for large files.
   */
  bufferSize?: number;
}

/**
 * Options for streaming/tailing the file
 */
export interface StreamOptions extends ReadOptions {
  /**
   * Enable streaming mode to tail the file after reading last N lines
   */
  enabled: boolean;

  /**
   * Polling interval in milliseconds (default: 1000)
   */
  pollInterval?: number;

  /**
   * AbortSignal to stop tailing
   */
  signal?: AbortSignal;
}

/**
 * Reads the last N lines from a file efficiently.
 * Can optionally continue streaming new lines as they are appended.
 *
 * @param filePath - Path to the file to read from
 * @param maxLines - Total lines to read from the end of the file
 * @param options - Optional options for reading/streaming
 * @returns A promise that resolves to a string, or an async generator if streaming is enabled
 *
 * @example
 * ```typescript
 * // Read last 10 lines
 * const lines = await readeof('/var/log/app.log', 10);
 *
 * // Read last 10 lines with custom encoding
 * const lines = await readeof('/var/log/app.log', 10, { encoding: 'utf8' });
 *
 * // Read last 10 lines and continue streaming
 * const controller = new AbortController();
 * for await (const line of readeof('/var/log/app.log', 10, {
 *   enabled: true,
 *   signal: controller.signal
 * })) {
 *   console.log(line);
 * }
 *
 * // Read last 10 lines and continue streaming with 30s timeout
 * for await (const line of readeof('/var/log/app.log', 10, {
 *   enabled: true,
 *   signal: AbortSignal.timeout(30_000),
 * })) {
 *   console.log(line);
 * }
 * ```
 */
export function readeof(
  filePath: string,
  maxLines: number,
  options: StreamOptions & { enabled: true },
): AsyncGenerator<string, void, unknown>;

export function readeof(
  filePath: string,
  maxLines: number,
  options?: StreamOptions & { enabled: false },
): Promise<string>;

export function readeof(
  filePath: string,
  maxLines: number,
  options?: ReadOptions,
): Promise<string>;

export function readeof(
  /**
   * Path to the file to read from
   */
  filePath: string,

  /**
   * Total lines to read from the end of the file
   */
  maxLines: number,

  /**
   * Optional options for reading/streaming
   */
  options?: StreamOptions | ReadOptions,
): Promise<string> | AsyncGenerator<string, void, unknown> {
  const encoding = options?.encoding ?? 'utf8';
  const bufferSize = options?.bufferSize ?? 16 * 1024;

  if ((options as StreamOptions)?.enabled) {
    return readeofStream(filePath, maxLines, encoding, bufferSize, options as StreamOptions);
  }
  return readeofOnce(filePath, maxLines, encoding, bufferSize);
}

/**
 * Internal function to read last N lines once (non-streaming)
 */
async function readeofOnce(
  filePath: string,
  maxLines: number,
  encoding: BufferEncoding,
  bufferSize: number,
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
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}

/**
 * Internal async generator to read last N lines and then stream new lines
 */
async function* readeofStream(
  filePath: string,
  maxLines: number,
  encoding: BufferEncoding,
  bufferSize: number,
  options: StreamOptions,
): AsyncGenerator<string, void, unknown> {
  const { pollInterval = 1000, signal } = options;

  let fileHandle: FileHandle | null = null;
  let position = 0;
  let remainder = '';

  try {
    fileHandle = await open(filePath, 'r');
    const stat = await fileHandle.stat();

    // First, read and yield the last N lines
    if (stat.size > 0 && maxLines > 0) {
      const buffer = Buffer.alloc(bufferSize);
      let linesFound = 0;
      let searchPosition = stat.size;
      let startReadPos = stat.size;

      while (searchPosition > 0 && linesFound < maxLines) {
        const readLength = Math.min(bufferSize, searchPosition);
        searchPosition -= readLength;

        const result = await fileHandle.read(buffer, 0, readLength, searchPosition);
        const bytesRead = result.bytesRead;

        for (let i = bytesRead - 1; i >= 0; i--) {
          if (buffer[i] === 10) {
            // dont count the very last newline in the last position
            if (searchPosition + i !== stat.size - 1 || linesFound > 0) {
              linesFound++;
            }

            if (linesFound >= maxLines) {
              startReadPos = searchPosition + i + 1;
              break;
            }
          }
        }
      }

      if (linesFound < maxLines) {
        startReadPos = 0;
      }

      // Read the last N lines content
      const lengthToRead = stat.size - startReadPos;
      const resultBuffer = Buffer.alloc(lengthToRead);
      await fileHandle.read(resultBuffer, 0, lengthToRead, startReadPos);

      const content = resultBuffer.toString(encoding);
      const lines = content.split('\n');

      // Yield each line from the last N lines
      for (const line of lines) {
        if (line.length > 0) {
          yield line;
        }
      }
    }

    // Set position to end of file for streaming
    position = stat.size;

    const streamBuffer = Buffer.alloc(bufferSize);

    // Now continue streaming new lines
    while (!signal?.aborted) {
      try {
        const currentStat = await fileHandle.stat();

        // Handle file truncation/rotation
        if (currentStat.size < position) {
          position = 0;
          remainder = '';
        }

        // Read new content if available
        if (currentStat.size > position) {
          const bytesToRead = Math.min(bufferSize, currentStat.size - position);
          const { bytesRead } = await fileHandle.read(
            streamBuffer,
            0,
            bytesToRead,
            position,
          );

          if (bytesRead > 0) {
            position += bytesRead;
            const chunk = streamBuffer.subarray(0, bytesRead).toString(encoding);
            const content = remainder + chunk;
            const lines = content.split('\n');

            // Keep the last incomplete line as remainder
            remainder = lines.pop() ?? '';

            // Yield complete lines
            for (const line of lines) {
              if (line.length > 0) {
                yield line;
              }
            }
          }
        }

        // Wait before next poll
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(resolve, pollInterval);
          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timeout);
              reject(new Error('Aborted'));
            },
            { once: true },
          );
        });
      } catch (error) {
        if (signal?.aborted) break;

        // Try to reopen file if it was deleted/recreated
        try {
          await fileHandle.close();
          fileHandle = await open(filePath, 'r');
          position = 0;
          remainder = '';
        } catch {
          throw error;
        }
      }
    }

    // Yield any remaining content
    if (remainder.length > 0) {
      yield remainder;
    }
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}
