import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../installer/index.js', () => ({
  install: vi.fn(),
  HOOKS_DIR: '/tmp/omc-test-hooks',
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { install } from '../installer/index.js';
import {
  reconcileUpdateRuntime,
  performUpdate,
} from '../features/auto-update.js';

const mockedExecSync = vi.mocked(execSync);
const mockedExistsSync = vi.mocked(existsSync);
const mockedMkdirSync = vi.mocked(mkdirSync);
const mockedInstall = vi.mocked(install);

describe('auto-update reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(true);
    mockedInstall.mockReturnValue({
      success: true,
      message: 'ok',
      installedAgents: [],
      installedCommands: [],
      installedSkills: [],
      hooksConfigured: true,
      hookConflicts: [],
      errors: [],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reconciles runtime state and refreshes hooks after update', () => {
    mockedExistsSync.mockReturnValue(false);

    const result = reconcileUpdateRuntime({ verbose: false });

    expect(result.success).toBe(true);
    expect(mockedMkdirSync).toHaveBeenCalledWith('/tmp/omc-test-hooks', { recursive: true });
    expect(mockedInstall).toHaveBeenCalledWith({
      force: true,
      verbose: false,
      skipClaudeCheck: true,
      forceHooks: true,
    });
  });

  it('is idempotent when reconciliation runs repeatedly', () => {
    const first = reconcileUpdateRuntime({ verbose: false });
    const second = reconcileUpdateRuntime({ verbose: false });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(mockedInstall).toHaveBeenNthCalledWith(1, {
      force: true,
      verbose: false,
      skipClaudeCheck: true,
      forceHooks: true,
    });
    expect(mockedInstall).toHaveBeenNthCalledWith(2, {
      force: true,
      verbose: false,
      skipClaudeCheck: true,
      forceHooks: true,
    });
  });

  it('runs reconciliation as part of performUpdate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v4.1.5',
        name: '4.1.5',
        published_at: '2026-02-09T00:00:00.000Z',
        html_url: 'https://example.com/release',
        body: 'notes',
        prerelease: false,
        draft: false,
      }),
    }));

    mockedExecSync.mockReturnValue('');

    const result = await performUpdate({ verbose: false });

    expect(result.success).toBe(true);
    expect(mockedExecSync).toHaveBeenCalledWith('npm install -g oh-my-claude-sisyphus@latest', expect.any(Object));
    expect(mockedInstall).toHaveBeenCalledWith({
      force: true,
      verbose: false,
      skipClaudeCheck: true,
      forceHooks: true,
    });
  });
});
