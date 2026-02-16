---
title: Projects
description: Organize work into isolated project workspaces with separate memory, files, and configuration.
---

# Projects

Projects let you organize your agent's work into isolated workspaces. Each project gets its own memory, workspace files, and configuration -- keeping unrelated tasks cleanly separated.

## Overview

By default, every agent operates in a single "default" workspace. When you enable projects, each named project gets:

- **Isolated workspace directory** -- files saved in one project do not appear in another
- **Isolated memory** -- memories stored in one project are not searchable from another
- **Per-project settings** -- each project can have its own prompt overrides and configuration
- **Independent session keys** -- conversations in different projects maintain separate context

The default project always exists and maps to the agent's original workspace, ensuring full backward compatibility.

## Quick Start

### Telegram

Use the `/project` command to manage projects:

```
/project list          -- List all configured projects
/project create myapp  -- Create a new project
/project switch myapp  -- Switch to a project
/project current       -- Show the active project
```

You can also use shorthand:

```
/project myapp         -- Switch to "myapp" (shortcut for switch)
/project ls            -- Alias for list
/project status        -- Alias for current
```

### CLI

Use the `--project` flag when starting a chat session:

```bash
crocbot chat --project myapp
```

### Gateway API

Projects are available through the gateway RPC protocol:

```
projects.list     -- List all projects for an agent
projects.create   -- Create a new project
projects.switch   -- Switch the active project
projects.current  -- Get the current active project
projects.delete   -- Delete a project
```

## Configuration

Projects are defined in the agent configuration under the `projects` key:

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "projects": [
          { "id": "webapp", "name": "Web Application" },
          { "id": "mobile", "name": "Mobile App" },
          { "id": "docs", "name": "Documentation" }
        ]
      }
    ]
  }
}
```

### Project ID Rules

- Must be lowercase alphanumeric with hyphens (kebab-case)
- Cannot be `default` (reserved for the implicit default workspace)
- Cannot contain path traversal sequences (`..`, `./`)
- Automatically normalized to lowercase

## How It Works

### Directory Structure

Each named project creates an isolated directory tree under the agent's state directory:

```
{STATE_DIR}/agents/{agentId}/projects/{projectId}/
  workspace/     -- Project-specific files (MEMORY.md, etc.)
  memory/        -- Project-scoped memory storage
  settings/      -- Project-specific configuration
  logs/          -- Project-specific logs
  metadata.json  -- Project metadata (creation time, schema version)
```

The default project uses the agent's original directories, so existing setups continue working without changes.

### Session Key Isolation

When a project is active, the session key includes a project segment:

```
agent:main:project:myapp:telegram:group:123
```

This ensures conversations in different projects maintain completely separate message history and context.

### Memory Isolation

Memories are stored per-project. A memory saved while working in "webapp" is not visible when searching from "mobile". This prevents unrelated information from cluttering search results.

## Backward Compatibility

- Agents with no `projects` configuration work exactly as before
- The "default" project maps to the original agent workspace
- All existing memory, workspace files, and settings remain accessible
- No migration is required -- projects are opt-in

## Limitations

- Project names cannot be changed after creation (delete and recreate instead)
- The default project cannot be deleted
- Cross-project memory search is not supported (by design)
