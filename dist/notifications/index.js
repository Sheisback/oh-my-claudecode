/**
 * Notification System - Public API
 *
 * Multi-platform lifecycle notifications for oh-my-claudecode.
 * Sends notifications to Discord, Telegram, Slack, and generic webhooks
 * on session lifecycle events.
 *
 * Usage:
 *   import { notify } from '../notifications/index.js';
 *   await notify('session-start', { sessionId, projectPath, ... });
 */
export { dispatchNotifications, sendDiscord, sendDiscordBot, sendTelegram, sendSlack, sendWebhook, } from "./dispatcher.js";
export { formatNotification, formatSessionStart, formatSessionStop, formatSessionEnd, formatSessionIdle, formatAskUserQuestion, } from "./formatter.js";
export { getCurrentTmuxSession, getTeamTmuxSessions, formatTmuxInfo, } from "./tmux.js";
export { getNotificationConfig, isEventEnabled, getEnabledPlatforms, } from "./config.js";
import { getNotificationConfig, isEventEnabled } from "./config.js";
import { formatNotification } from "./formatter.js";
import { dispatchNotifications } from "./dispatcher.js";
import { getCurrentTmuxSession } from "./tmux.js";
import { basename } from "path";
/**
 * High-level notification function.
 *
 * Reads config, checks if the event is enabled, formats the message,
 * and dispatches to all configured platforms. Non-blocking, swallows errors.
 *
 * @param event - The notification event type
 * @param data - Partial payload data (message will be auto-formatted if not provided)
 * @returns DispatchResult or null if notifications are not configured/enabled
 */
export async function notify(event, data) {
    try {
        const config = getNotificationConfig();
        if (!config || !isEventEnabled(config, event)) {
            return null;
        }
        // Build the full payload
        const payload = {
            event,
            sessionId: data.sessionId,
            message: "", // Will be formatted below
            timestamp: data.timestamp || new Date().toISOString(),
            tmuxSession: data.tmuxSession ?? getCurrentTmuxSession() ?? undefined,
            projectPath: data.projectPath,
            projectName: data.projectName ||
                (data.projectPath ? basename(data.projectPath) : undefined),
            modesUsed: data.modesUsed,
            contextSummary: data.contextSummary,
            durationMs: data.durationMs,
            agentsSpawned: data.agentsSpawned,
            agentsCompleted: data.agentsCompleted,
            reason: data.reason,
            activeMode: data.activeMode,
            iteration: data.iteration,
            maxIterations: data.maxIterations,
            question: data.question,
            incompleteTasks: data.incompleteTasks,
        };
        // Format the message
        payload.message = data.message || formatNotification(payload);
        // Dispatch to all enabled platforms
        return await dispatchNotifications(config, event, payload);
    }
    catch (error) {
        // Never let notification failures propagate to hooks
        console.error("[notifications] Error:", error instanceof Error ? error.message : error);
        return null;
    }
}
//# sourceMappingURL=index.js.map