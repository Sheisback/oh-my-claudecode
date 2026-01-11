/**
 * Persistent Mode Hook
 *
 * Unified handler for persistent work modes: ultrawork, ralph-loop, and todo-continuation.
 * This hook intercepts Stop events and enforces work continuation based on:
 * 1. Active ultrawork mode with pending todos
 * 2. Active ralph-loop with incomplete promise
 * 3. Any pending todos (general enforcement)
 *
 * Priority order: Ralph Loop > Ultrawork > Todo Continuation
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  readUltraworkState,
  incrementReinforcement,
  deactivateUltrawork,
  getUltraworkPersistenceMessage
} from '../ultrawork-state/index.js';
import {
  readRalphState,
  incrementRalphIteration,
  clearRalphState,
  detectCompletionPromise,
  type RalphLoopState
} from '../ralph-loop/index.js';
import { checkIncompleteTodos, getNextPendingTodo } from '../todo-continuation/index.js';
import { TODO_CONTINUATION_PROMPT } from '../../installer/hooks.js';

export interface PersistentModeResult {
  /** Whether to block the stop event */
  shouldBlock: boolean;
  /** Message to inject into context */
  message: string;
  /** Which mode triggered the block */
  mode: 'ralph-loop' | 'ultrawork' | 'todo-continuation' | 'none';
  /** Additional metadata */
  metadata?: {
    todoCount?: number;
    iteration?: number;
    maxIterations?: number;
    reinforcementCount?: number;
  };
}

/**
 * Check Ralph Loop state and determine if it should continue
 */
async function checkRalphLoop(
  sessionId?: string,
  directory?: string
): Promise<PersistentModeResult | null> {
  const state = readRalphState(directory || process.cwd());

  if (!state || !state.active) {
    return null;
  }

  // Check if this is the right session
  if (state.session_id && sessionId && state.session_id !== sessionId) {
    return null;
  }

  // Check for completion promise in transcript
  const completed = detectCompletionPromise(sessionId || '', state.completion_promise);

  if (completed) {
    clearRalphState(directory || process.cwd());
    return {
      shouldBlock: false,
      message: `[RALPH LOOP COMPLETE] Task completed after ${state.iteration} iteration(s). Great work!`,
      mode: 'none'
    };
  }

  // Check max iterations
  if (state.iteration >= state.max_iterations) {
    clearRalphState(directory || process.cwd());
    return {
      shouldBlock: false,
      message: `[RALPH LOOP STOPPED] Max iterations (${state.max_iterations}) reached without completion promise. Consider reviewing the task requirements.`,
      mode: 'none'
    };
  }

  // Increment and continue
  const newState = incrementRalphIteration(directory || process.cwd());
  if (!newState) {
    return null;
  }

  const continuationPrompt = `<ralph-loop-continuation>

[RALPH LOOP - ITERATION ${newState.iteration}/${newState.max_iterations}]

Your previous attempt did not output the completion promise. The work is NOT done yet.

CRITICAL INSTRUCTIONS:
1. Review your progress and the original task
2. Check your todo list - are ALL items marked complete?
3. Continue from where you left off
4. When FULLY complete, output: <promise>${newState.completion_promise}</promise>
5. Do NOT stop until the task is truly done

${newState.prompt ? `Original task: ${newState.prompt}` : ''}

</ralph-loop-continuation>

---

`;

  return {
    shouldBlock: true,
    message: continuationPrompt,
    mode: 'ralph-loop',
    metadata: {
      iteration: newState.iteration,
      maxIterations: newState.max_iterations
    }
  };
}

/**
 * Check Ultrawork state and determine if it should reinforce
 */
async function checkUltrawork(
  sessionId?: string,
  directory?: string,
  hasIncompleteTodos?: boolean
): Promise<PersistentModeResult | null> {
  const state = readUltraworkState(directory);

  if (!state || !state.active) {
    return null;
  }

  // If bound to a session, only reinforce for that session
  if (state.session_id && sessionId && state.session_id !== sessionId) {
    return null;
  }

  // If no incomplete todos, ultrawork can complete
  if (!hasIncompleteTodos) {
    deactivateUltrawork(directory);
    return {
      shouldBlock: false,
      message: `[ULTRAWORK COMPLETE] All tasks finished. Ultrawork mode deactivated. Well done!`,
      mode: 'none'
    };
  }

  // Reinforce ultrawork mode
  const newState = incrementReinforcement(directory);
  if (!newState) {
    return null;
  }

  const message = getUltraworkPersistenceMessage(newState);

  return {
    shouldBlock: true,
    message,
    mode: 'ultrawork',
    metadata: {
      reinforcementCount: newState.reinforcement_count
    }
  };
}

/**
 * Check for incomplete todos (baseline enforcement)
 */
async function checkTodoContinuation(
  sessionId?: string,
  directory?: string
): Promise<PersistentModeResult | null> {
  const result = await checkIncompleteTodos(sessionId, directory);

  if (result.count === 0) {
    return null;
  }

  const nextTodo = getNextPendingTodo(result);
  const nextTaskInfo = nextTodo
    ? `\n\nNext task: "${nextTodo.content}" (${nextTodo.status})`
    : '';

  const message = `<todo-continuation>

${TODO_CONTINUATION_PROMPT}

[Status: ${result.count} of ${result.total} tasks remaining]${nextTaskInfo}

</todo-continuation>

---

`;

  return {
    shouldBlock: true,
    message,
    mode: 'todo-continuation',
    metadata: {
      todoCount: result.count
    }
  };
}

/**
 * Main persistent mode checker
 * Checks all persistent modes in priority order and returns appropriate action
 */
export async function checkPersistentModes(
  sessionId?: string,
  directory?: string
): Promise<PersistentModeResult> {
  const workingDir = directory || process.cwd();

  // First, check for incomplete todos (we need this info for ultrawork)
  const todoResult = await checkIncompleteTodos(sessionId, workingDir);
  const hasIncompleteTodos = todoResult.count > 0;

  // Priority 1: Ralph Loop (explicit loop mode)
  const ralphResult = await checkRalphLoop(sessionId, workingDir);
  if (ralphResult?.shouldBlock) {
    return ralphResult;
  }

  // Priority 2: Ultrawork Mode (performance mode with persistence)
  const ultraworkResult = await checkUltrawork(sessionId, workingDir, hasIncompleteTodos);
  if (ultraworkResult?.shouldBlock) {
    return ultraworkResult;
  }

  // Priority 3: Todo Continuation (baseline enforcement)
  if (hasIncompleteTodos) {
    const todoContResult = await checkTodoContinuation(sessionId, workingDir);
    if (todoContResult?.shouldBlock) {
      return todoContResult;
    }
  }

  // No blocking needed
  return {
    shouldBlock: false,
    message: '',
    mode: 'none'
  };
}

/**
 * Create hook output for Claude Code
 */
export function createHookOutput(result: PersistentModeResult): {
  continue: boolean;
  reason?: string;
  message?: string;
} {
  if (!result.shouldBlock) {
    // Allow stop, but optionally inject completion message
    return {
      continue: true,
      message: result.message || undefined
    };
  }

  // Block stop and inject continuation message
  return {
    continue: false,
    reason: result.message
  };
}
