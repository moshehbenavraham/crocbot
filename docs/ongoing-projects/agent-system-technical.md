# Agent System Technical Reference

Complete technical reference for crocbot's agent orchestration system. Covers configuration, system prompts, model selection, execution flow, sub-agents, memory, and tool policies.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Configuration Schema](#configuration-schema)
3. [System Prompts](#system-prompts)
4. [Model Selection](#model-selection)
5. [Execution Pipeline](#execution-pipeline)
6. [Sub-Agents](#sub-agents)
7. [Tool Policies](#tool-policies)
8. [Memory & Context](#memory--context)
9. [Agent Types](#agent-types)
10. [Key Functions Reference](#key-functions-reference)
11. [Extending the Agent System](#extending-the-agent-system)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Agent Orchestration                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────────────────────┐ │
│  │   Config    │───▶│  Agent Scope    │───▶│     Model Selection          │ │
│  │  (agents)   │    │  Resolution     │    │  (provider/model + auth)     │ │
│  └─────────────┘    └─────────────────┘    └──────────────────────────────┘ │
│         │                   │                           │                   │
│         ▼                   ▼                           ▼                   │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────────────────────┐ │
│  │  Bindings   │    │ System Prompt   │    │   Auth Profile Store         │ │
│  │  (routing)  │    │    Builder      │    │   (API keys + cooldown)      │ │
│  └─────────────┘    └─────────────────┘    └──────────────────────────────┘ │
│                             │                           │                   │
│                             ▼                           ▼                   │
│                    ┌─────────────────────────────────────────────────────┐  │
│                    │              runEmbeddedPiAgent()                   │  │
│                    │  ├── Context window guard                           │  │
│                    │  ├── Build payloads (system + user messages)        │  │
│                    │  ├── Run attempt with model/auth                    │  │
│                    │  ├── Stream messages + handle tool calls            │  │
│                    │  ├── Fallback on failure (next model in chain)      │  │
│                    │  └── Compaction on context overflow                 │  │
│                    └─────────────────────────────────────────────────────┘  │
│                                        │                                    │
│                    ┌───────────────────┼────────────────────┐               │
│                    ▼                   ▼                    ▼               │
│           ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│           │  Sub-Agent   │    │   Session    │    │   Cron/Isolated      │  │
│           │   Spawning   │    │  Transcript  │    │      Agents          │  │
│           └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Source File Map

| Category | Files | Purpose |
|----------|-------|---------|
| **Config Types** | `src/config/types.agents.ts` | `AgentConfig`, `AgentsConfig`, `AgentBinding` |
| **Config Types** | `src/config/types.agent-defaults.ts` | `AgentDefaultsConfig`, `CliBackendConfig` |
| **Agent Scope** | `src/agents/agent-scope.ts` | `resolveAgentConfig()`, `resolveDefaultAgentId()` |
| **System Prompts** | `src/agents/system-prompt.ts` | `buildAgentSystemPrompt()` |
| **System Prompts** | `src/agents/subagent-announce.ts` | `buildSubagentSystemPrompt()` |
| **Model Selection** | `src/agents/model-selection.ts` | `resolveDefaultModelForAgent()`, `parseModelRef()` |
| **Model Fallback** | `src/agents/model-fallback.ts` | `runWithModelFallback()` |
| **Model Auth** | `src/agents/model-auth.ts` | Auth profile store, API key resolution |
| **Main Execution** | `src/agents/pi-embedded-runner/run.ts` | `runEmbeddedPiAgent()` |
| **Model Discovery** | `src/agents/pi-embedded-runner/model.ts` | `resolveModel()` |
| **Tool Policies** | `src/agents/pi-tools.policy.ts` | `resolveSubagentToolPolicy()`, `filterToolsByPolicy()` |
| **Defaults** | `src/agents/defaults.ts` | `DEFAULT_PROVIDER`, `DEFAULT_MODEL`, `DEFAULT_CONTEXT_TOKENS` |
| **Sub-Agent Spawn** | `src/agents/tools/sessions-spawn-tool.ts` | `createSessionsSpawnTool()` |
| **Sub-Agent Registry** | `src/agents/subagent-registry.ts` | `registerSubagentRun()` |
| **Context Guard** | `src/agents/context-window-guard.ts` | `evaluateContextWindowGuard()` |
| **Compaction** | `src/agents/compaction.ts` | `compactEmbeddedPiSessionDirect()` |
| **Cron Agent** | `src/cron/isolated-agent/run.ts` | `runCronIsolatedAgentTurn()` |
| **CLI Agent** | `src/agents/cli-runner.ts` | `runCliAgent()` |

---

## Configuration Schema

### Agent List (`config.agents.list[]`)

```typescript
type AgentConfig = {
  id: string;                          // Unique agent identifier
  default?: boolean;                   // Mark as default agent
  name?: string;                       // Human-readable name
  workspace?: string;                  // Working directory (default: ~/croc-{agentId})
  agentDir?: string;                   // Agent state dir (default: ~/.crocbot/agents/{agentId}/agent)
  model?: AgentModelConfig;            // Model override (see below)
  memorySearch?: MemorySearchConfig;   // Per-agent memory search settings
  humanDelay?: HumanDelayConfig;       // Delay between block replies
  heartbeat?: HeartbeatConfig;         // Per-agent heartbeat overrides
  identity?: IdentityConfig;           // Agent identity/persona
  groupChat?: GroupChatConfig;         // Group chat behavior
  subagents?: {
    allowAgents?: string[];            // Allow spawning under other agent ids ("*" = any)
    model?: AgentModelConfig;          // Default model for spawned sub-agents
  };
  sandbox?: {
    mode?: "off" | "non-main" | "all"; // Sandbox mode
    workspaceAccess?: "none" | "ro" | "rw";
    sessionToolsVisibility?: "spawned" | "all";
    scope?: "session" | "agent" | "shared";
    docker?: SandboxDockerSettings;
    browser?: SandboxBrowserSettings;
    prune?: SandboxPruneSettings;
  };
  tools?: AgentToolsConfig;            // Per-agent tool policies
};
```

### Model Configuration

```typescript
type AgentModelConfig =
  | string                              // "provider/model" format
  | {
      primary?: string;                 // Primary model
      fallbacks?: string[];             // Fallback chain
    };
```

### Agent Defaults (`config.agents.defaults`)

```typescript
type AgentDefaultsConfig = {
  model?: {
    primary?: string;                   // Default primary model
    fallbacks?: string[];               // Default fallback chain
  };
  imageModel?: {
    primary?: string;                   // Image-capable model
    fallbacks?: string[];
  };
  models?: Record<string, {             // Model catalog with aliases
    alias?: string;                     // Short alias (e.g., "opus" → "anthropic/claude-opus-4-5")
    params?: Record<string, unknown>;   // Provider-specific params
  }>;
  workspace?: string;                   // Default workspace
  userTimezone?: string;                // IANA timezone (e.g., "Asia/Jerusalem")
  timeFormat?: "auto" | "12" | "24";    // Time format preference
  contextTokens?: number;               // Display-only context window
  thinkingDefault?: ThinkLevel;         // Default thinking level
  verboseDefault?: "off" | "on" | "full";
  elevatedDefault?: "off" | "on" | "ask" | "full";
  maxConcurrent?: number;               // Max concurrent agent runs (default: 1)
  timeoutSeconds?: number;              // Run timeout
  heartbeat?: HeartbeatConfig;          // Periodic background runs
  subagents?: {
    maxConcurrent?: number;             // Max concurrent sub-agents (default: 1)
    archiveAfterMinutes?: number;       // Auto-archive after N minutes
    model?: AgentModelConfig;           // Default sub-agent model
  };
  cliBackends?: Record<string, CliBackendConfig>;  // CLI fallback backends
  compaction?: AgentCompactionConfig;   // Compaction tuning
  memorySearch?: MemorySearchConfig;    // Vector memory defaults
  sandbox?: SandboxConfig;              // Default sandbox settings
};
```

### Agent Bindings (`config.bindings[]`)

Routes channels/chats to specific agents:

```typescript
type AgentBinding = {
  agentId: string;                      // Target agent
  match: {
    channel: string;                    // "telegram", "whatsapp", etc.
    accountId?: string;                 // Specific account
    peer?: {
      kind: "dm" | "group" | "channel";
      id: string;
    };
    guildId?: string;                   // Discord guild
    teamId?: string;                    // Slack team
  };
};
```

### JSON Config Example

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai-codex/gpt-5.1-codex-mini",
        "fallbacks": ["anthropic/claude-opus-4-5", "google/gemini-2.5-pro"]
      },
      "models": {
        "anthropic/claude-opus-4-5": { "alias": "opus" },
        "openai-codex/gpt-5.1-codex-mini": { "alias": "codex" }
      },
      "workspace": "~/croc",
      "userTimezone": "Asia/Jerusalem",
      "maxConcurrent": 2,
      "subagents": {
        "maxConcurrent": 4,
        "archiveAfterMinutes": 30
      }
    },
    "list": [
      {
        "id": "main",
        "default": true,
        "name": "Krox",
        "workspace": "~/croc",
        "identity": {
          "name": "Krox",
          "emoji": "🐊"
        }
      }
    ]
  },
  "bindings": [
    {
      "agentId": "main",
      "match": { "channel": "telegram" }
    }
  ]
}
```

---

## System Prompts

### Main System Prompt

**File:** `src/agents/system-prompt.ts`
**Function:** `buildAgentSystemPrompt(params)`

The system prompt is assembled from multiple sections based on `promptMode`:

| Mode | Description | Use Case |
|------|-------------|----------|
| `"full"` | All sections | Main agent |
| `"minimal"` | Reduced sections (tooling, workspace, runtime) | Sub-agents |
| `"none"` | Basic identity line only | Minimal contexts |

### Prompt Sections

```
You are a personal assistant running inside crocbot.

## Tooling
Tool availability (filtered by policy):
- read: Read file contents
- write: Create or overwrite files
- edit: Make precise edits to files
- exec: Run shell commands (pty available for TTY-required CLIs)
- web_search: Search the web (Brave API)
- web_fetch: Fetch and extract readable content from a URL
- message: Send messages and channel actions
- sessions_spawn: Spawn a sub-agent session
[... more tools based on availability ...]

## Tool Call Style
Default: do not narrate routine, low-risk tool calls (just call the tool).
[...]

## crocbot CLI Quick Reference
[... CLI help ...]

## Skills (mandatory)                    # Skipped in minimal mode
[... skills guidance ...]

## Memory Recall                         # Skipped in minimal mode
Before answering anything about prior work, decisions, dates...
run memory_search on MEMORY.md + memory/*.md [...]

## Model Aliases                         # Skipped in minimal mode
[... alias mappings ...]

## Workspace
Your working directory is: /home/user/croc
[...]

## Documentation                         # Skipped in minimal mode
crocbot docs: /home/user/projects/crocbot/docs
[...]

## User Identity                         # Skipped in minimal mode
Owner numbers: +1234567890. Treat messages from these numbers as the user.

## Current Date & Time
Time zone: Asia/Jerusalem

## Reply Tags                            # Skipped in minimal mode
[... reply routing ...]

## Messaging                             # Skipped in minimal mode
[... channel/message tool guidance ...]

## Voice (TTS)                           # Skipped in minimal mode
[... TTS hints ...]

## Reactions                             # If configured
[... reaction guidance ...]

## Reasoning Format                      # If reasoning enabled
ALL internal reasoning MUST be inside <think>...</think>.
[...]

# Project Context
[... SOUL.md, CLAUDE.md, etc. injected files ...]

## Silent Replies                        # Skipped in minimal mode
When you have nothing to say, respond with ONLY: [[SILENT_REPLY]]
[...]

## Heartbeats                            # Skipped in minimal mode
[... heartbeat format ...]

## Runtime
Runtime: agent=main | host=krox | os=Linux (x86_64) | node=v22.19.0 | model=openai-codex/gpt-5.1-codex-mini | channel=telegram | capabilities=inlineButtons | thinking=off
Reasoning: off (hidden unless on/stream). Toggle /reasoning; /status shows Reasoning when enabled.
```

### Sub-Agent System Prompt

**File:** `src/agents/subagent-announce.ts`
**Function:** `buildSubagentSystemPrompt(params)`

Sub-agents get a minimal, task-focused prompt:

```
# Subagent Context

You are a **subagent** spawned by the main agent for a specific task.

## Your Role
- You were created to handle: {task description}
- Complete this task. That's your entire purpose.
- You are NOT the main agent. Don't try to be.

## Rules
1. **Stay focused** - Do your assigned task, nothing else
2. **Complete the task** - Your final message will be automatically reported to the main agent
3. **Don't initiate** - No heartbeats, no proactive actions, no side quests
4. **Be ephemeral** - You may be terminated after task completion. That's fine.

## Output Format
When complete, your final response should include:
- What you accomplished or found
- Any relevant details the main agent should know
- Keep it concise but informative

## What You DON'T Do
- NO user conversations (that's main agent's job)
- NO external messages (email, tweets, etc.) unless explicitly tasked
- NO cron jobs or persistent state
- NO pretending to be the main agent
- NO using the `message` tool directly

## Session Context
- Label: {label}
- Requester session: {requesterSessionKey}
- Requester channel: {channel}
- Your session: {childSessionKey}
```

### Injected Context Files

These files are loaded from the workspace and injected into the system prompt:

| File | Purpose |
|------|---------|
| `SOUL.md` | Agent persona and tone |
| `CLAUDE.md` | Codebase instructions |
| `BOOTSTRAP.md` | Auto-generated during onboarding |
| `MEMORY.md` | Persistent memory notes |
| `HEARTBEAT.md` | Heartbeat-specific instructions |
| `TOOLS.md` | Tool usage guidance |

---

## Model Selection

### Defaults

**File:** `src/agents/defaults.ts`

```typescript
export const DEFAULT_PROVIDER = "anthropic";
export const DEFAULT_MODEL = "claude-opus-4-5";
export const DEFAULT_CONTEXT_TOKENS = 200_000;
```

### Resolution Hierarchy

**File:** `src/agents/model-selection.ts`

1. **Per-agent override**: `config.agents.list[i].model.primary`
2. **Global default**: `config.agents.defaults.model.primary`
3. **Fallback**: `DEFAULT_MODEL` constant

```typescript
function resolveDefaultModelForAgent(params: {
  cfg: crocbotConfig;
  agentId?: string;
}): ModelRef {
  // Check agent-specific override
  const agentModelOverride = params.agentId
    ? resolveAgentModelPrimary(params.cfg, params.agentId)
    : undefined;

  // Merge with defaults and resolve
  return resolveConfiguredModelRef({
    cfg: mergedConfig,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });
}
```

### Model Reference Format

```typescript
type ModelRef = {
  provider: string;  // e.g., "anthropic", "openai-codex", "google"
  model: string;     // e.g., "claude-opus-4-5", "gpt-5.1-codex-mini"
};

// Parsing: "provider/model" or alias lookup
function parseModelRef(raw: string, defaultProvider: string): ModelRef | null {
  // "opus" → alias lookup → { provider: "anthropic", model: "claude-opus-4-5" }
  // "anthropic/claude-opus-4-5" → direct parse
  // "gpt-5" → { provider: defaultProvider, model: "gpt-5" }
}
```

### Model Aliases

Configure shortcuts in `config.agents.defaults.models`:

```json
{
  "agents": {
    "defaults": {
      "models": {
        "anthropic/claude-opus-4-5": { "alias": "opus" },
        "anthropic/claude-sonnet-4": { "alias": "sonnet" },
        "openai-codex/gpt-5.1-codex-mini": { "alias": "codex" }
      }
    }
  }
}
```

Usage: `/model opus` resolves to `anthropic/claude-opus-4-5`

### Fallback Chain

**File:** `src/agents/model-fallback.ts`

When a model fails (auth error, rate limit, timeout), the system tries the next model in the fallback chain:

```typescript
// Config
{
  "model": {
    "primary": "openai-codex/gpt-5.1-codex-mini",
    "fallbacks": ["anthropic/claude-opus-4-5", "google/gemini-2.5-pro"]
  }
}

// Execution order on failure:
// 1. openai-codex/gpt-5.1-codex-mini (primary)
// 2. anthropic/claude-opus-4-5 (first fallback)
// 3. google/gemini-2.5-pro (second fallback)
```

### Auth Profile Store

**File:** `src/agents/model-auth.ts`
**Location:** `~/.crocbot/agents/{agentId}/auth-profiles.json`

```typescript
type AuthProfileStore = {
  profiles: Record<string, {
    provider: string;
    apiKey: string;
    region?: string;
    lastUsed?: number;
    failure?: {
      reason: string;
      cooldownUntil: number;
    };
  }>;
};
```

**Key Functions:**
- `ensureAuthProfileStore(agentDir)` - Load/create store
- `resolveAuthProfileOrder(params)` - Determine profile evaluation order
- `markAuthProfileUsed(store, profileId)` - Update last-used timestamp
- `markAuthProfileFailure(store, profileId, reason)` - Mark failed with cooldown
- `isProfileInCooldown(store, profileId)` - Check cooldown status
- `getApiKeyForModel(provider, modelId, store)` - Retrieve API key

---

## Execution Pipeline

### Main Entry Point

**File:** `src/agents/pi-embedded-runner/run.ts`
**Function:** `runEmbeddedPiAgent(params)`

```typescript
type RunEmbeddedPiAgentParams = {
  sessionId: string;
  sessionKey?: string;
  provider?: string;
  model?: string;
  workspaceDir: string;
  agentDir?: string;
  config?: crocbotConfig;
  prompt: string;
  systemPrompt?: string;
  extraSystemPrompt?: string;
  lane?: string;
  // ... more params
};

type EmbeddedPiRunResult = {
  status: "ok" | "error" | "timeout" | "compaction" | "failover";
  error?: string;
  usage?: UsageLike;
  model?: string;
  provider?: string;
  // ... more fields
};
```

### Execution Flow

```
runEmbeddedPiAgent()
│
├─1. Resolve Session & Global Lanes
│   └── enqueueCommandInLane() for concurrency control
│
├─2. Resolve Model
│   └── resolveModel(provider, modelId, agentDir, config)
│
├─3. Context Window Guard
│   ├── Warn if < 32k tokens
│   └── Block if < 16k tokens
│
├─4. Load Auth Profiles
│   ├── ensureAuthProfileStore()
│   └── resolveAuthProfileOrder() with cooldown
│
├─5. Build Payloads
│   └── buildEmbeddedRunPayloads()
│       ├── System prompt
│       ├── User messages (from transcript)
│       └── Current prompt
│
├─6. Run Attempt
│   └── runEmbeddedAttempt()
│       ├── Stream messages
│       ├── Handle tool calls
│       └── Collect assistant response
│
├─7. Handle Failures
│   ├── Auth error → Try next profile
│   ├── Rate limit → Cooldown + fallback
│   ├── Context overflow → Compaction
│   └── Timeout → Failover to next model
│
└─8. Return Result
    └── { status, usage, model, provider, ... }
```

### Concurrency Control

**File:** `src/agents/pi-embedded-runner/lanes.ts`

```typescript
// Lane types
const AGENT_LANE_MAIN = "agent";      // Main agent runs
const AGENT_LANE_SUBAGENT = "subagent"; // Sub-agent runs

// Concurrency limits (from config)
// agents.defaults.maxConcurrent (default: 1)
// agents.defaults.subagents.maxConcurrent (default: 1)
```

### Context Window Guard

**File:** `src/agents/context-window-guard.ts`

```typescript
const CONTEXT_WINDOW_WARN_BELOW_TOKENS = 32_000;
const CONTEXT_WINDOW_HARD_MIN_TOKENS = 16_000;

function evaluateContextWindowGuard(params): {
  tokens: number;
  source: string;
  shouldWarn: boolean;
  shouldBlock: boolean;
}
```

### Compaction

**File:** `src/agents/compaction.ts`

When context overflows, old turns are summarized:

```typescript
// Triggered by context overflow errors
compactEmbeddedPiSessionDirect({
  sessionId,
  messages,
  provider,
  model,
  // ...
})

// Config tuning
{
  "agents": {
    "defaults": {
      "compaction": {
        "mode": "default" | "safeguard",
        "reserveTokensFloor": 0,
        "maxHistoryShare": 0.5,
        "memoryFlush": {
          "enabled": true,
          "softThresholdTokens": 10000
        }
      }
    }
  }
}
```

---

## Sub-Agents

### Spawning via `sessions_spawn` Tool

**File:** `src/agents/tools/sessions-spawn-tool.ts`

```typescript
const SessionsSpawnToolSchema = Type.Object({
  task: Type.String(),                     // Task description
  label: Type.Optional(Type.String()),     // Display label
  agentId: Type.Optional(Type.String()),   // Target agent (default: same as requester)
  model: Type.Optional(Type.String()),     // Model override
  thinking: Type.Optional(Type.String()),  // Thinking level
  runTimeoutSeconds: Type.Optional(Type.Number()),
  cleanup: Type.Optional(Type.Enum(["delete", "keep"])),
});
```

### Spawn Flow

```
sessions_spawn({ task: "Research X" })
│
├─1. Parse requester session key → agent ID
│
├─2. Check allowAgents permission
│   └── config.agents[i].subagents.allowAgents
│
├─3. Generate child session key
│   └── "subagent:{uuid}"
│
├─4. Register sub-agent run
│   └── registerSubagentRun({ runId, childSessionKey, task, cleanup })
│
├─5. Build child system prompt
│   └── buildSubagentSystemPrompt({ task, requesterSessionKey, ... })
│
├─6. Call gateway to spawn
│   └── callGateway({ method: "agent", params: { sessionKey, message, ... } })
│
└─7. Return session key to requester
```

### Sub-Agent Announce Flow

**File:** `src/agents/subagent-announce.ts`

When a sub-agent completes, results are announced to the requester:

```typescript
runSubagentAnnounceFlow({
  requesterSessionKey,
  childSessionKey,
  task,
  // ...
})
// Sends summary message to requester session
```

### Sub-Agent Registry

**File:** `src/agents/subagent-registry.ts`

```typescript
type SubagentRunRecord = {
  runId: string;
  childSessionKey: string;
  requesterSessionKey: string;
  task: string;
  cleanup: "delete" | "keep";
  startedAt: number;
};

// In-memory registry
const subagentRuns = new Map<string, SubagentRunRecord>();

// Persistence
// ~/.crocbot/agents/{agentId}/subagent-runs.json
```

---

## Tool Policies

### Default Sub-Agent Deny List

**File:** `src/agents/pi-tools.policy.ts`

```typescript
const DEFAULT_SUBAGENT_TOOL_DENY = [
  // Session management - main agent orchestrates
  "sessions_list",
  "sessions_history",
  "sessions_send",
  "sessions_spawn",     // No nested spawning

  // System admin - dangerous from subagent
  "gateway",
  "agents_list",

  // Interactive setup - not a task
  "whatsapp_login",

  // Status/scheduling - main agent coordinates
  "session_status",
  "cron",

  // Memory - pass relevant info in spawn prompt instead
  "memory_search",
  "memory_get",
];
```

### Policy Resolution

```typescript
// Global policy
config.tools.allow / config.tools.deny

// Per-provider policy
config.tools.byProvider["anthropic"].allow / .deny
config.tools.byProvider["anthropic/claude-opus-4-5"].allow / .deny

// Per-agent policy
config.agents.list[i].tools.allow / .deny
config.agents.list[i].tools.byProvider[...].allow / .deny

// Sub-agent policy
config.tools.subagents.tools.allow / .deny
```

### Tool Filtering

```typescript
function filterToolsByPolicy(
  tools: AnyAgentTool[],
  policy?: SandboxToolPolicy
): AnyAgentTool[] {
  // Apply allow/deny patterns
  // Supports wildcards: "group:*", "sessions_*"
}
```

### Tool Groups

Expand via `expandToolGroups()`:

| Group | Tools |
|-------|-------|
| `group:file` | `read`, `write`, `edit`, `ls`, `find` |
| `group:exec` | `exec`, `process` |
| `group:web` | `web_search`, `web_fetch`, `browser` |
| `group:sessions` | `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn` |
| `group:admin` | `gateway`, `agents_list`, `cron` |

---

## Memory & Context

### Session Transcript

**Location:** `~/.crocbot/sessions/{sessionId}.jsonl`

Each line is a JSON-serialized message:

```typescript
type AgentMessage = {
  role: "user" | "assistant" | "system";
  content: string | ContentBlock[];
  timestamp?: number;
  // Tool calls, tool results, etc.
};
```

### Session Store

**File:** `src/config/sessions.ts`

```typescript
// Location: ~/.crocbot/sessions/{store}.json (default: sessions.json)
type SessionStore = Record<string, SessionEntry>;

type SessionEntry = {
  sessionId: string;
  model?: string;
  modelProvider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  // Delivery context, timestamps, etc.
};
```

### Memory Search

**File:** `src/agents/memory-search.ts`

```typescript
type MemorySearchConfig = {
  enabled?: boolean;
  sources?: Array<"memory" | "sessions">;
  provider?: "openai" | "gemini" | "local";
  model?: string;
  store?: {
    driver?: "sqlite";
    path?: string;
    vector?: { enabled?: boolean };
  };
  query?: {
    maxResults?: number;
    minScore?: number;
    hybrid?: { enabled?: boolean; vectorWeight?: number };
  };
};
```

**Tools:**
- `memory_search` - Semantic search across MEMORY.md + memory/
- `memory_get` - Retrieve specific lines by path

### Context Pruning

**File:** `src/config/types.agent-defaults.ts`

```typescript
type AgentContextPruningConfig = {
  mode?: "off" | "cache-ttl";
  ttl?: string;                    // Duration (e.g., "30m")
  keepLastAssistants?: number;
  softTrimRatio?: number;
  hardClearRatio?: number;
  tools?: { allow?: string[]; deny?: string[] };
  softTrim?: { maxChars?: number; headChars?: number; tailChars?: number };
  hardClear?: { enabled?: boolean; placeholder?: string };
};
```

---

## Agent Types

### Main Agent

- Bound to channels via `config.bindings`
- Full system prompt (`promptMode: "full"`)
- All tools available (subject to policy)
- Persistent across sessions
- Can spawn sub-agents

### Sub-Agents

- Spawned by main agent via `sessions_spawn`
- Minimal system prompt (`promptMode: "minimal"`)
- Reduced tool set (no session/admin/memory tools)
- Ephemeral (may be cleaned up after task)
- Cannot spawn further sub-agents

### Cron/Isolated Agents

**File:** `src/cron/isolated-agent/run.ts`

```typescript
runCronIsolatedAgentTurn(params: {
  job: CronJob;
  config: crocbotConfig;
  // ...
}): Promise<RunCronAgentTurnResult>
```

- Triggered by cron scheduler
- Isolated session (`{agentId}:cron:{jobId}`)
- Scoped to agent workspace

### CLI Agents

**File:** `src/agents/cli-runner.ts`

```typescript
runCliAgent(params: {
  provider: string;
  model: string;
  prompt: string;
  // ...
}): Promise<CliAgentResult>
```

- Text-only fallback (no tools)
- Uses external CLI backends (e.g., `claude-cli`)
- Configured via `config.agents.defaults.cliBackends`

---

## Key Functions Reference

### Agent Configuration

| Function | File | Purpose |
|----------|------|---------|
| `resolveAgentConfig(cfg, agentId)` | `agent-scope.ts` | Get config for specific agent |
| `resolveDefaultAgentId(cfg)` | `agent-scope.ts` | Get default agent ID |
| `resolveAgentModelPrimary(cfg, agentId)` | `agent-scope.ts` | Get agent's primary model |
| `listAgentEntries(cfg)` | `agents.config.ts` | List all agents |
| `applyAgentConfig(cfg, params)` | `agents.config.ts` | Update agent config |

### System Prompts

| Function | File | Purpose |
|----------|------|---------|
| `buildAgentSystemPrompt(params)` | `system-prompt.ts` | Build main agent prompt |
| `buildSubagentSystemPrompt(params)` | `subagent-announce.ts` | Build sub-agent prompt |
| `buildRuntimeLine(info)` | `system-prompt.ts` | Build runtime info line |

### Model Selection

| Function | File | Purpose |
|----------|------|---------|
| `resolveDefaultModelForAgent(params)` | `model-selection.ts` | Get agent's model |
| `parseModelRef(raw, defaultProvider)` | `model-selection.ts` | Parse "provider/model" |
| `resolveModelRefFromString(params)` | `model-selection.ts` | Resolve with alias lookup |
| `buildModelAliasIndex(params)` | `model-selection.ts` | Build alias→ref map |

### Execution

| Function | File | Purpose |
|----------|------|---------|
| `runEmbeddedPiAgent(params)` | `pi-embedded-runner/run.ts` | Main execution entry |
| `runEmbeddedAttempt(params)` | `pi-embedded-runner/run/attempt.ts` | Single run attempt |
| `resolveModel(provider, model, agentDir, cfg)` | `pi-embedded-runner/model.ts` | Resolve model info |
| `evaluateContextWindowGuard(params)` | `context-window-guard.ts` | Check context limits |
| `compactEmbeddedPiSessionDirect(params)` | `compaction.ts` | Compact on overflow |

### Tool Policies

| Function | File | Purpose |
|----------|------|---------|
| `resolveSubagentToolPolicy(cfg)` | `pi-tools.policy.ts` | Get sub-agent policy |
| `filterToolsByPolicy(tools, policy)` | `pi-tools.policy.ts` | Apply allow/deny |
| `resolveEffectiveToolPolicy(params)` | `pi-tools.policy.ts` | Get effective policy |
| `isToolAllowedByPolicyName(name, policy)` | `pi-tools.policy.ts` | Check single tool |

### Sub-Agents

| Function | File | Purpose |
|----------|------|---------|
| `createSessionsSpawnTool(opts)` | `sessions-spawn-tool.ts` | Create spawn tool |
| `registerSubagentRun(record)` | `subagent-registry.ts` | Register sub-agent |
| `runSubagentAnnounceFlow(params)` | `subagent-announce.ts` | Announce completion |

---

## Extending the Agent System

### Adding a New Agent Type

1. **Define Config Type** in `src/config/types.agents.ts`:
   ```typescript
   export type CustomAgentConfig = {
     // Custom fields
   };
   ```

2. **Add System Prompt Builder** in `src/agents/`:
   ```typescript
   export function buildCustomAgentSystemPrompt(params: {
     // ...
   }): string {
     return [
       "# Custom Agent Context",
       "...",
     ].join("\n");
   }
   ```

3. **Create Execution Function**:
   ```typescript
   export async function runCustomAgent(params: {
     // ...
   }): Promise<CustomAgentResult> {
     // Execution logic
   }
   ```

### Adding Custom Tool Policies

1. **Define Policy** in config:
   ```json
   {
     "tools": {
       "customPolicy": {
         "allow": ["read", "write", "exec"],
         "deny": ["gateway", "sessions_*"]
       }
     }
   }
   ```

2. **Apply in Code**:
   ```typescript
   const policy = resolveCustomToolPolicy(cfg);
   const filteredTools = filterToolsByPolicy(allTools, policy);
   ```

### Adding Model Providers

1. **Register Provider** in `src/agents/models-config.providers.ts`:
   ```typescript
   registerProvider({
     id: "newprovider",
     name: "New Provider",
     authType: "api_key",
     baseUrl: "https://api.newprovider.com/v1",
   });
   ```

2. **Add Auth Resolution** in `src/agents/model-auth.ts`

3. **Configure in JSON**:
   ```json
   {
     "models": {
       "providers": {
         "newprovider": {
           "baseUrl": "https://api.newprovider.com/v1",
           "models": [
             { "id": "model-1", "contextWindow": 128000 }
           ]
         }
       }
     }
   }
   ```

### Modifying System Prompts

1. **Add Section Builder** in `src/agents/system-prompt.ts`:
   ```typescript
   function buildCustomSection(params: { isMinimal: boolean; /* ... */ }) {
     if (params.isMinimal) return [];
     return [
       "## Custom Section",
       "Your custom guidance here.",
       "",
     ];
   }
   ```

2. **Include in Main Builder**:
   ```typescript
   const lines = [
     // ... existing sections ...
     ...buildCustomSection({ isMinimal, /* ... */ }),
   ];
   ```

---

## Quick Reference

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `BRAVE_API_KEY` | Brave Search API key |

### File Locations

| Path | Purpose |
|------|---------|
| `~/.crocbot/crocbot.json` | Main config |
| `~/.crocbot/agents/{agentId}/` | Per-agent state |
| `~/.crocbot/agents/{agentId}/auth-profiles.json` | Auth profiles |
| `~/.crocbot/sessions/` | Session transcripts |
| `~/croc/` | Default workspace |
| `~/croc/SOUL.md` | Agent persona |
| `~/croc/MEMORY.md` | Persistent memory |

### Config Paths

| Path | Type | Description |
|------|------|-------------|
| `agents.defaults.model.primary` | string | Default model |
| `agents.defaults.model.fallbacks` | string[] | Fallback chain |
| `agents.defaults.models.{key}.alias` | string | Model alias |
| `agents.defaults.workspace` | string | Default workspace |
| `agents.defaults.userTimezone` | string | IANA timezone |
| `agents.defaults.maxConcurrent` | number | Concurrency limit |
| `agents.defaults.subagents.maxConcurrent` | number | Sub-agent concurrency |
| `agents.list[i].id` | string | Agent ID |
| `agents.list[i].model` | string/object | Per-agent model |
| `agents.list[i].tools.allow` | string[] | Tool allowlist |
| `agents.list[i].tools.deny` | string[] | Tool denylist |
| `bindings[i].agentId` | string | Bound agent |
| `bindings[i].match.channel` | string | Channel match |

---

*Last updated: 2026-02-01*
