/**
 * Auto Slash Command Constants
 *
 * Configuration values for slash command detection.
 *
 * Adapted from oh-my-opencode's auto-slash-command hook.
 */

export const HOOK_NAME = 'auto-slash-command' as const;

/** XML tags to mark auto-expanded slash commands */
export const AUTO_SLASH_COMMAND_TAG_OPEN = '<auto-slash-command>';
export const AUTO_SLASH_COMMAND_TAG_CLOSE = '</auto-slash-command>';

/** Pattern to detect slash commands at start of message */
export const SLASH_COMMAND_PATTERN = /^\/([a-zA-Z][\w-]*)\s*(.*)/;

/**
 * Claude Code native commands whose short names OMC must not shadow.
 *
 * Keep this in sync with CC_NATIVE_COMMANDS in src/features/builtin-skills/skills.ts.
 * Skills whose short name matches an entry here are renamed to 'omc-<name>' in the
 * builtin-skills registry and are also excluded from the auto-slash-command hook so
 * that typing e.g. /review or /plan invokes the native CC behaviour, not an OMC skill.
 */
export const CC_NATIVE_COMMANDS = new Set([
  'review',
  'plan',
  'security-review',
  'init',
  'doctor',
  'help',
  'config',
  'clear',
  'memory',
]);

/**
 * Commands that should NOT be auto-expanded
 * (they have special handling elsewhere or are now skills with oh-my-claudecode: prefix)
 */
export const EXCLUDED_COMMANDS = new Set([
  'ralph',
  'oh-my-claudecode:ralplan',
  'oh-my-claudecode:ultraqa',
  'oh-my-claudecode:learner',
  'oh-my-claudecode:plan',
  'oh-my-claudecode:cancel',
  // Claude Code built-in commands that shouldn't be expanded
  'help',
  'clear',
  'history',
  'exit',
  'quit',
  // Claude Code native commands — short-name aliases that must pass through to CC unchanged.
  // Derived from CC_NATIVE_COMMANDS above (kept in sync manually).
  'review',
  'plan',
  'security-review',
  'init',
  'doctor',
  'config',
  'memory',
]);
