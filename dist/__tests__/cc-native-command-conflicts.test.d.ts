/**
 * Tests for issue #703: OMC skill short names must not override Claude Code native commands.
 *
 * Covers two layers of protection:
 *   1. EXCLUDED_COMMANDS / CC_NATIVE_COMMANDS in constants.ts → the auto-slash-command
 *      hook must pass native CC commands through without expansion.
 *   2. discoverAllCommands() in executor.ts → skills whose short name collides with a
 *      CC native command must be filtered out of the discovery results.
 */
export {};
//# sourceMappingURL=cc-native-command-conflicts.test.d.ts.map