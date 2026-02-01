/**
 * Live Data Injection
 *
 * Resolves `!command` lines in skill/command templates by executing the command
 * and replacing the line with its output wrapped in <live-data> tags.
 */

import { execSync } from 'child_process';

const TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 50 * 1024; // 50KB

/**
 * Check if a line is a live-data command (starts with optional whitespace then `!`)
 */
export function isLiveDataLine(line: string): boolean {
  return /^\s*!(.+)/.test(line);
}

/**
 * Extract ranges of fenced code blocks so we can skip `!` lines inside them.
 * Returns an array of [startLine, endLine] pairs (0-indexed).
 */
function getCodeBlockRanges(lines: string[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let openIndex: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(`{3,}|~{3,})/.test(lines[i])) {
      if (openIndex === null) {
        openIndex = i;
      } else {
        ranges.push([openIndex, i]);
        openIndex = null;
      }
    }
  }
  return ranges;
}

function isInsideCodeBlock(lineIndex: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => lineIndex > start && lineIndex < end);
}

function executeCommand(command: string): { stdout: string; error: boolean } {
  try {
    const stdout = execSync(command, {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES + 1024, // slight headroom for truncation check
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = stdout ?? '';
    let truncated = false;

    if (Buffer.byteLength(output, 'utf-8') > MAX_OUTPUT_BYTES) {
      // Truncate to 50KB
      const buf = Buffer.from(output, 'utf-8').subarray(0, MAX_OUTPUT_BYTES);
      output = buf.toString('utf-8');
      truncated = true;
    }

    if (truncated) {
      output += '\n... [output truncated at 50KB]';
    }

    return { stdout: output, error: false };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? (err as { stderr?: string }).stderr || err.message : String(err);
    return { stdout: String(message), error: true };
  }
}

/**
 * Resolve all `!command` lines in content by executing them and injecting output.
 * Lines inside fenced code blocks are skipped.
 */
export function resolveLiveData(content: string): string {
  const lines = content.split('\n');
  const codeBlockRanges = getCodeBlockRanges(lines);

  const result = lines.map((line, index) => {
    if (!isLiveDataLine(line) || isInsideCodeBlock(index, codeBlockRanges)) {
      return line;
    }

    const command = line.replace(/^\s*!/, '').trim();
    const { stdout, error } = executeCommand(command);

    if (error) {
      return `<live-data command="${command}" error="true">${stdout}</live-data>`;
    }

    return `<live-data command="${command}">${stdout}</live-data>`;
  });

  return result.join('\n');
}
