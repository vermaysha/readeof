# ReadEOF

A high-performance, memory-efficient library to read large files backward (line-by-line). Zero dependencies.

## Features

- Fast file reading from the end without loading entire file into memory
- Memory efficient using configurable buffer sizes
- Supports various encodings

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
const content = await readeof('./data.txt', 20, 'latin1');
```

### Custom Buffer Size

```typescript
import { readeof } from 'readeof';

// Use 64KB buffer for very large files
const content = await readeof('./huge-log.log', 100, 'utf8', 64 * 1024);
```

### Real-time Log Monitoring

```typescript
import { readeof } from 'readeof';

async function monitorLog(filePath: string) {
  setInterval(async () => {
    const latestLines = await readeof(filePath, 5);
    console.clear();
    console.log('=== Latest Logs ===');
    console.log(latestLines);
  }, 2000);
}

monitorLog('/var/log/application.log');
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

## License

See [LICENSE](LICENSE) file for details.

## Author

Ashary Vermaysha (<vermaysha@gmail.com>)
