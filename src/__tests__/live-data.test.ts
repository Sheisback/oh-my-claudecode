import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveLiveData, isLiveDataLine } from '../hooks/auto-slash-command/live-data.js';
import * as child_process from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockedExecSync = vi.mocked(child_process.execSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isLiveDataLine', () => {
  it('returns true for lines starting with !', () => {
    expect(isLiveDataLine('!echo hello')).toBe(true);
    expect(isLiveDataLine('  !git status')).toBe(true);
  });

  it('returns false for non-command lines', () => {
    expect(isLiveDataLine('normal text')).toBe(false);
    expect(isLiveDataLine('# heading')).toBe(false);
    expect(isLiveDataLine('')).toBe(false);
  });
});

describe('resolveLiveData', () => {
  it('replaces a basic !command with live-data output', () => {
    mockedExecSync.mockReturnValue('hello world\n');
    const result = resolveLiveData('!echo hello');
    expect(result).toBe('<live-data command="echo hello">hello world\n</live-data>');
    expect(mockedExecSync).toHaveBeenCalledWith('echo hello', expect.objectContaining({ timeout: 10_000 }));
  });

  it('handles multiple commands', () => {
    mockedExecSync
      .mockReturnValueOnce('output1\n')
      .mockReturnValueOnce('output2\n');

    const input = 'before\n!cmd1\nmiddle\n!cmd2\nafter';
    const result = resolveLiveData(input);

    expect(result).toContain('<live-data command="cmd1">output1\n</live-data>');
    expect(result).toContain('<live-data command="cmd2">output2\n</live-data>');
    expect(result).toContain('before');
    expect(result).toContain('middle');
    expect(result).toContain('after');
  });

  it('skips !lines inside code blocks', () => {
    const input = '```\n!echo skip-me\n```\n!echo run-me';
    mockedExecSync.mockReturnValue('ran\n');

    const result = resolveLiveData(input);

    expect(result).toContain('!echo skip-me'); // preserved as-is
    expect(result).toContain('<live-data command="echo run-me">ran\n</live-data>');
    expect(mockedExecSync).toHaveBeenCalledTimes(1);
  });

  it('handles failed commands with error attribute', () => {
    const error = new Error('command failed') as Error & { stderr: string };
    error.stderr = 'permission denied\n';
    mockedExecSync.mockImplementation(() => { throw error; });

    const result = resolveLiveData('!bad-cmd');
    expect(result).toBe('<live-data command="bad-cmd" error="true">permission denied\n</live-data>');
  });

  it('handles timeout errors', () => {
    const error = new Error('ETIMEDOUT');
    mockedExecSync.mockImplementation(() => { throw error; });

    const result = resolveLiveData('!slow-cmd');
    expect(result).toContain('error="true"');
    expect(result).toContain('ETIMEDOUT');
  });

  it('truncates output exceeding 50KB', () => {
    const bigOutput = 'x'.repeat(60 * 1024);
    mockedExecSync.mockReturnValue(bigOutput);

    const result = resolveLiveData('!big-cmd');
    expect(result).toContain('[output truncated at 50KB]');
    // The live-data tag should still be present
    expect(result).toContain('<live-data command="big-cmd">');
    expect(result).toContain('</live-data>');
  });

  it('handles empty output', () => {
    mockedExecSync.mockReturnValue('');
    const result = resolveLiveData('!empty-cmd');
    expect(result).toBe('<live-data command="empty-cmd"></live-data>');
  });

  it('does not re-scan output for ! prefixes', () => {
    mockedExecSync.mockReturnValue('!nested-cmd\n');
    const result = resolveLiveData('!echo nested');
    // Should only call execSync once (the original command)
    expect(mockedExecSync).toHaveBeenCalledTimes(1);
    // The output contains !nested-cmd but it's not executed
    expect(result).toContain('!nested-cmd');
  });

  it('handles indented !commands', () => {
    mockedExecSync.mockReturnValue('output\n');
    const result = resolveLiveData('  !git diff');
    expect(result).toContain('<live-data command="git diff">');
  });

  it('leaves content without ! lines unchanged', () => {
    const input = 'just some\nregular text\nno commands here';
    const result = resolveLiveData(input);
    expect(result).toBe(input);
    expect(mockedExecSync).not.toHaveBeenCalled();
  });
});
