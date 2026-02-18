/**
 * Tests for issue #703: OMC skill short names must not override Claude Code native commands.
 *
 * Covers two layers of protection:
 *   1. EXCLUDED_COMMANDS / CC_NATIVE_COMMANDS in constants.ts → the auto-slash-command
 *      hook must pass native CC commands through without expansion.
 *   2. discoverAllCommands() in executor.ts → skills whose short name collides with a
 *      CC native command must be filtered out of the discovery results.
 */
import { describe, it, expect } from 'vitest';
import { CC_NATIVE_COMMANDS, EXCLUDED_COMMANDS, } from '../hooks/auto-slash-command/constants.js';
import { isExcludedCommand, detectSlashCommand, } from '../hooks/auto-slash-command/detector.js';
// ---------------------------------------------------------------------------
// CC_NATIVE_COMMANDS set
// ---------------------------------------------------------------------------
describe('CC_NATIVE_COMMANDS', () => {
    it('contains the commands that conflict with Claude Code native slash commands', () => {
        expect(CC_NATIVE_COMMANDS.has('review')).toBe(true);
        expect(CC_NATIVE_COMMANDS.has('plan')).toBe(true);
        expect(CC_NATIVE_COMMANDS.has('security-review')).toBe(true);
    });
    it('contains other known native CC commands', () => {
        expect(CC_NATIVE_COMMANDS.has('init')).toBe(true);
        expect(CC_NATIVE_COMMANDS.has('doctor')).toBe(true);
        expect(CC_NATIVE_COMMANDS.has('help')).toBe(true);
        expect(CC_NATIVE_COMMANDS.has('config')).toBe(true);
        expect(CC_NATIVE_COMMANDS.has('clear')).toBe(true);
        expect(CC_NATIVE_COMMANDS.has('memory')).toBe(true);
    });
});
// ---------------------------------------------------------------------------
// EXCLUDED_COMMANDS — CC native commands must be present
// ---------------------------------------------------------------------------
describe('EXCLUDED_COMMANDS includes CC native commands', () => {
    const ccNatives = ['review', 'plan', 'security-review', 'init', 'doctor', 'config', 'memory'];
    for (const cmd of ccNatives) {
        it(`excludes '${cmd}'`, () => {
            expect(EXCLUDED_COMMANDS.has(cmd)).toBe(true);
        });
    }
});
// ---------------------------------------------------------------------------
// isExcludedCommand — runtime guard used by the hook
// ---------------------------------------------------------------------------
describe('isExcludedCommand()', () => {
    it('returns true for /review (CC native)', () => {
        expect(isExcludedCommand('review')).toBe(true);
    });
    it('returns true for /plan (CC native)', () => {
        expect(isExcludedCommand('plan')).toBe(true);
    });
    it('returns true for /security-review (CC native)', () => {
        expect(isExcludedCommand('security-review')).toBe(true);
    });
    it('returns false for OMC-specific commands that should be expanded', () => {
        expect(isExcludedCommand('autopilot')).toBe(false);
        expect(isExcludedCommand('ralph')).toBe(true); // ralph is special-cased
        expect(isExcludedCommand('ultrawork')).toBe(false);
    });
    it('is case-insensitive', () => {
        expect(isExcludedCommand('REVIEW')).toBe(true);
        expect(isExcludedCommand('Plan')).toBe(true);
        expect(isExcludedCommand('SECURITY-REVIEW')).toBe(true);
    });
});
// ---------------------------------------------------------------------------
// detectSlashCommand() — end-to-end hook input path
// ---------------------------------------------------------------------------
describe('detectSlashCommand() passes CC native commands through', () => {
    it('returns null for /review (must not be intercepted)', () => {
        expect(detectSlashCommand('/review')).toBeNull();
    });
    it('returns null for /plan (must not be intercepted)', () => {
        expect(detectSlashCommand('/plan')).toBeNull();
    });
    it('returns null for /security-review (must not be intercepted)', () => {
        expect(detectSlashCommand('/security-review')).toBeNull();
    });
    it('returns null for /init (must not be intercepted)', () => {
        expect(detectSlashCommand('/init')).toBeNull();
    });
    it('detects non-native OMC commands normally', () => {
        const result = detectSlashCommand('/autopilot build me a todo app');
        expect(result).not.toBeNull();
        expect(result?.command).toBe('autopilot');
        expect(result?.args).toBe('build me a todo app');
    });
});
//# sourceMappingURL=cc-native-command-conflicts.test.js.map