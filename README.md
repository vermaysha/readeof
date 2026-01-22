# ReadEOF

A high-performance, memory-efficient library to read large files backward (line-by-line). Zero dependencies.

## Features

- Fast file reading from the end without loading entire file into memory
- Memory efficient using configurable buffer sizes
- Supports various encodings
- Real-time file tailing (like `tail -f`) with streaming support
- Automatic handling of file truncation/rotation

## Installation

```bash
npm install readeof
```

## Usage

### Basic Example

```typescript
import { readeof } from 'readeof';

// Read last 10 lines from log file
const lastLines = await readeof('/var/log/app.log', 10);
console.log(lastLines);
```

### Reading Recent Logs

```typescript
import { readeof } from 'readeof';

// Read last 50 lines for debugging
const recentLogs = await readeof('./app.log', 50);
console.log(recentLogs);
```

### Custom Encoding

```typescript
import { readeof } from 'readeof';

// Read file with latin1 encoding
const content = await readeof('./data.txt', 20, { encoding: 'latin1' });
```

### Custom Buffer Size

```typescript
import { readeof } from 'readeof';

// Use 64KB buffer for very large files
const content = await readeof('./huge-log.log', 100, {
  encoding: 'utf8',
  bufferSize: 64 * 1024,
});
```

### Real-time Log Streaming (tail -f)

Stream new lines as they are appended to the file. First reads the last N lines, then continues watching for new content.

```typescript
import { readeof } from 'readeof';

// Stream with AbortController for manual control
const controller = new AbortController();

for await (const line of readeof('/var/log/app.log', 10, {
  enabled: true,
  signal: controller.signal,
})) {
  console.log(line);

  // Stop streaming when needed
  if (line.includes('SHUTDOWN')) {
    controller.abort();
  }
}
```

### Streaming with Timeout

```typescript
import { readeof } from 'readeof';

// Stream for 30 seconds then stop automatically
for await (const line of readeof('/var/log/app.log', 10, {
  enabled: true,
  signal: AbortSignal.timeout(30_000),
})) {
  console.log(line);
}
```

### Streaming with Custom Poll Interval

```typescript
import { readeof } from 'readeof';

// Check for new content every 500ms instead of default 1000ms
for await (const line of readeof('/var/log/app.log', 10, {
  enabled: true,
  pollInterval: 500,
  signal: AbortSignal.timeout(60_000),
})) {
  console.log(line);
}
```

### Error Analysis

```typescript
import { readeof } from 'readeof';

async function findRecentErrors(logPath: string) {
  const recentLogs = await readeof(logPath, 1000);
  const errors = recentLogs
    .split('\n')
    .filter(line => line.includes('ERROR'));
  
  console.log(`Found ${errors.length} errors in last 1000 lines`);
}
```

## API Reference

### `readeof(filePath, maxLines, options?)`

Reads the last N lines from a file efficiently.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `filePath` | `string` | Path to the file to read from |
| `maxLines` | `number` | Total lines to read from the end of the file |
| `options` | `ReadOptions \| StreamOptions` | Optional configuration options |

#### ReadOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `encoding` | `BufferEncoding` | `'utf8'` | File encoding |
| `bufferSize` | `number` | `16384` | Buffer size for reading (16KB) |

#### StreamOptions (extends ReadOptions)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | - | Enable streaming mode |
| `pollInterval` | `number` | `1000` | Polling interval in milliseconds |
| `signal` | `AbortSignal` | - | Signal to stop streaming |

#### Returns

- **Without streaming**: `Promise<string>` - The last N lines as a single string
- **With streaming**: `AsyncGenerator<string>` - Yields each line as it appears

## License

See [LICENSE](LICENSE) file for details.

## Author

Ashary Vermaysha (<vermaysha@gmail.com>)
