/**
 * Auto Slash Command Constants
 *
 * Configuration values for slash command detection.
 *
 * Adapted from oh-my-opencode's auto-slash-command hook.
 */
export declare const HOOK_NAME: "auto-slash-command";
/** XML tags to mark auto-expanded slash commands */
export declare const AUTO_SLASH_COMMAND_TAG_OPEN = "<auto-slash-command>";
export declare const AUTO_SLASH_COMMAND_TAG_CLOSE = "</auto-slash-command>";
/** Pattern to detect slash commands at start of message */
export declare const SLASH_COMMAND_PATTERN: RegExp;
/**
 * Claude Code native commands whose short names OMC must not shadow.
 *
 * Keep this in sync with CC_NATIVE_COMMANDS in src/features/builtin-skills/skills.ts.
 * Skills whose short name matches an entry here are renamed to 'omc-<name>' in the
 * builtin-skills registry and are also excluded from the auto-slash-command hook so
 * that typing e.g. /review or /plan invokes the native CC behaviour, not an OMC skill.
 */
export declare const CC_NATIVE_COMMANDS: Set<string>;
/**
 * Commands that should NOT be auto-expanded
 * (they have special handling elsewhere or are now skills with oh-my-claudecode: prefix)
 */
export declare const EXCLUDED_COMMANDS: Set<string>;
//# sourceMappingURL=constants.d.ts.map