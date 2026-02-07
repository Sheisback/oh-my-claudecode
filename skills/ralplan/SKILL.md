---
name: ralplan
description: Iterative planning with Planner, Architect, and Critic until consensus
---

# Ralplan Command

**This is an alias for `/plan --consensus`**

Ralplan orchestrates three specialized agents—Planner, Architect, and Critic—in an iterative loop until consensus is reached on a comprehensive work plan.

## Usage

```
/oh-my-claudecode:ralplan [task]
```

## What It Does

Invokes the plan skill with --consensus mode, which:
1. Creates initial plan with Planner agent
2. Consults Architect for architectural questions
3. Reviews with Critic agent
4. Iterates until Critic approves (max 5 iterations)
5. **Presents approved plan to user for explicit consent before any implementation**

**CRITICAL:** Ralplan NEVER proceeds to implementation (branching, code execution, or file modification) without explicit user approval. After Critic consensus, the orchestrator enters Claude Code's native Plan Mode (`EnterPlanMode` → `ExitPlanMode`) to present the plan for user approval. Falls back to `AskUserQuestion` (Proceed/Adjust/Discard) if Plan Mode is unavailable.

**State:** After Critic consensus, state transitions to `awaiting_user_approval`. The orchestrator enters Plan Mode for native approval UX. User choices: **Approve** (execute), **Request changes** (re-plan), or reject. Falls back to AskUserQuestion with Proceed/Adjust/Discard if Plan Mode is unavailable.

## Implementation

When this skill is invoked, immediately invoke the plan skill with consensus mode:

```
Invoke Skill: plan --consensus {{ARGUMENTS}}
```

Pass all arguments to the plan skill. The plan skill handles all consensus logic, state management, and iteration.

**Enforcement:** Ralplan inherits and enforces all hard approval-gate invariants defined in `commands/ralplan.md`. If `/plan --consensus` behavior diverges from the approval gate rules (HARD RULE 1 and HARD RULE 2), the ralplan command-level rules take precedence.

## External Model Consultation (Preferred)

Ralplan inherits external model consultation capabilities from the plan skill. During consensus iterations, agents SHOULD consult Codex for:
- Architecture validation (architect agent)
- Planning validation (planner agent)
- Review cross-check (critic agent)

See `/plan` skill documentation for full consultation protocol.

## See Also

- `/plan` - Base planning skill with all modes
- `/plan --consensus` - Direct invocation of consensus mode
- `/cancel` - Cancel active planning session
