# Resource Type Guide

Comprehensive guide for selecting and designing Claude Code resources. Use this guide when creating new resources or deciding between resource types for multi-resource specs.

---

## Quick Reference

| Resource | Use When | Scope | Invocation |
|----------|----------|-------|------------|
| **Agent** | Autonomous decision-making, multi-step workflows | Domain expertise | Task tool / agent invocation |
| **Skill** | Reusable domain knowledge, deterministic patterns | Specific capability | Auto-activation by context |
| **Command** | User entry points, workflow triggers | User action | `/command-name` |
| **Workflow** | Coordinated multi-agent pipelines | Multi-step process | Orchestrator-driven |
| **Plugin** | Bundled collection of components | Feature domain | Installation |
| **Hook** | Lifecycle events, automation triggers | Tool interception | Event-driven |
| **MCP Tool** | Single utility function for LLM tool calling | Tool capability | Agent tool call via MCP |
| **MCP Server** | Multi-tool service for distribution | Tool service | MCP client (uvx/npx) |
| **Template** | Reusable output schemas, starter patterns | Code generation | Reference/copy |

---

## Agent

### When to Use

- **Autonomous decision-making** that requires reasoning about multiple options
- **Multi-step workflows** with branching logic based on intermediate results
- **Domain expertise** that needs deep context and tool access
- **Orchestration** of other agents or complex tool sequences

### When NOT to Use

- Simple, deterministic transformations (use Skill instead)
- User-triggered one-shot actions (use Command instead)
- Passive knowledge reference (use Skill instead)
- Simple event responses (use Hook instead)

### Characteristics

| Aspect | Agent Behavior |
|--------|---------------|
| **Activation** | Explicit invocation via Task tool |
| **Context** | Isolated - receives task description, not full conversation |
| **Tools** | Has own tool access configured in definition |
| **Model** | Can specify different model than parent (sonnet/opus/haiku) |
| **Turns** | Can have multiple conversation turns (configurable max_turns) |
| **State** | No persistent state between invocations |

### Structure

```yaml
---
name: domain-expert
description: >
  [Domain] expert specializing in [specific capabilities].
  Use PROACTIVELY when [scenarios].

  Examples:
  <example>
  Context: User needs [specific task]
  user: "[Example request]"
  assistant: "I'll use the domain-expert agent to [specific action]"
  <commentary>
  [Why this agent is appropriate]
  </commentary>
  </example>

tools: Read, Write, Edit, Bash(git:*)
model: sonnet
max_turns: 100
---

# Domain Expert

You are a [role] specializing in [domain].

## Core Responsibilities

- [Specific responsibility 1]
- [Specific responsibility 2]

## Approach

When [scenario]:
1. [Step with example]
2. [Step with example]

## Constraints

- [Boundary 1]
- [Boundary 2]

## Examples

### [Scenario Name]

[Detailed example with input/output]
```

### Examples

- **iac-analyzer** - Analyzes repositories to understand structure and dependencies
- **research-lead** - Plans and coordinates research across multiple specialists

### Single vs Multiple

| Scenario | Recommendation |
|----------|----------------|
| One domain, focused task | Single agent |
| Related domains, shared context | Single agent with sections |
| Distinct domains, different tools | Multiple agents |
| Pipeline stages, handoff | Multiple agents |

---

## Skill

### When to Use

- **Reusable domain knowledge** that applies across multiple contexts
- **Deterministic patterns** with clear trigger conditions
- **Reference documentation** that should load on-demand
- **Code templates** or best practices that get applied consistently

### When NOT to Use

- Complex reasoning or multi-step decisions (use Agent instead)
- User-triggered explicit actions (use Command instead)
- Tool interception or automation (use Hook instead)
- Bundling multiple components (use Plugin instead)

### Characteristics

| Aspect | Skill Behavior |
|--------|----------------|
| **Activation** | Automatic when context matches trigger terms |
| **Context** | Injected into current conversation |
| **Tools** | Uses parent agent's tools |
| **Model** | Uses parent agent's model |
| **Turns** | Single injection, no separate turns |
| **State** | No state - pure context injection |

### Structure

```
skill-name/
├── SKILL.md              # Main skill definition (required)
├── examples/             # Usage examples (optional)
│   ├── basic-usage.md
│   └── advanced-patterns.md
├── templates/            # Code templates (optional)
│   └── code-template.py
└── references/           # Reference docs (optional)
    └── api-docs.md
```

**SKILL.md Format:**

```yaml
---
name: skill-name
description: >
  [What it does]

  Activate when user mentions: [trigger terms]

  Use for: [scenarios]
  Do NOT use for: [out of scope]
---

# Skill Name

## Capabilities

- [Capability 1]
- [Capability 2]

## Usage

1. [Instruction]
2. [Instruction]

## Patterns

### [Pattern Name]

[Pattern description with example]

## Examples

See `examples/` directory for detailed usage.
```

### Examples

- **kubernetes-native** - K8s manifest patterns and best practices
- **joplin-research** - Formatting guidelines for Joplin notes
- **agent-definition-creation** - Instructions for creating agents

### Single vs Multiple (Skill Sets)

| Scenario | Recommendation |
|----------|----------------|
| One cohesive capability | Single SKILL.md |
| Variants of same capability | Multiple skills (terraform-{aws,gcp,azure}) |
| Unrelated capabilities | Separate plugins or standalone skills |
| Progressive detail | Single skill with examples/ directory |

---

## Command

### When to Use

- **User-triggered actions** with explicit `/command` invocation
- **Workflow entry points** that kick off multi-step processes
- **Parameterized operations** with arguments
- **Shortcuts** for frequently-used agent invocations

### When NOT to Use

- Autonomous behavior based on context (use Skill instead)
- Complex multi-turn reasoning (use Agent instead)
- Event-driven automation (use Hook instead)

### Characteristics

| Aspect | Command Behavior |
|--------|-----------------|
| **Activation** | Explicit `/command-name` by user |
| **Context** | Full current conversation available |
| **Arguments** | $1, $2, $ARGUMENTS, @file, !command |
| **Tools** | Uses allowed_tools configuration |
| **Model** | Uses current agent's model |
| **Turns** | Expands to prompt, then normal turn |

### Structure

```yaml
---
name: command-name
description: Short description shown in /help
allowed_tools: Read, Edit, Bash(git:*)
---

# Command Template

When this command is invoked with: /command-name $ARGUMENTS

## Parameters

- `$1` - First argument (required): [description]
- `$2` - Second argument (optional): [description]
- `${2:-default}` - With default value

## Procedure

1. [Step 1]
2. [Step 2]

## Examples

### Example: /command-name arg1

[Expected behavior]
```

### Examples

- **/commit** - Create git commit with conventional format
- **/iac** - IaC generation workflow trigger

### Single vs Multiple

| Scenario | Recommendation |
|----------|----------------|
| One action, optional args | Single command |
| Related actions, shared context | Single command with subcommands |
| Distinct unrelated actions | Multiple commands |

---

## Workflow

### When to Use

- **Multi-stage pipelines** with ordered execution
- **Agent coordination** with handoff between specialists
- **Dependency management** between steps
- **Resumable processes** with checkpointing

### When NOT to Use

- Single-agent tasks (use Agent directly)
- Simple sequential commands (use Command instead)
- Parallel independent tasks (use multiple Agents instead)

### Characteristics

| Aspect | Workflow Behavior |
|--------|------------------|
| **Activation** | Orchestrator-driven or command-triggered |
| **Context** | Shared workspace, artifact-based communication |
| **Agents** | Coordinates multiple specialized agents |
| **State** | Persisted in task_list.json or similar |
| **Resumption** | Supports pause/resume at stage boundaries |

### Structure

```yaml
# workflow-spec.yaml
name: research-pipeline
description: Multi-stage research workflow

stages:
  - name: discovery
    agent: research-lead
    inputs:
      - topic
    outputs:
      - research-plan.yaml

  - name: investigation
    agent: research-specialist
    parallel: true
    inputs:
      - research-plan.yaml
    outputs:
      - findings/*.yaml

  - name: synthesis
    agent: report-writer
    depends_on:
      - investigation
    inputs:
      - findings/*.yaml
    outputs:
      - report.md

checkpoints:
  - after: discovery
  - after: investigation
```

### Examples

- **Research pipeline** - Discovery → Investigation → Synthesis
- **Code review workflow** - Analyze → Review → Report

---

## Plugin

### When to Use

- **Bundling related components** (agents + skills + commands)
- **Distribution** of reusable functionality
- **Team standardization** of workflows
- **Domain packages** with cohesive capabilities

### When NOT to Use

- Single standalone component (just create that component)
- Temporary experimental features
- User-specific customizations (use settings instead)

### Characteristics

| Aspect | Plugin Behavior |
|--------|----------------|
| **Activation** | Installation registers all components |
| **Components** | Agents, skills, commands, hooks, templates |
| **Configuration** | Via plugin.json and settings |
| **Dependencies** | Can depend on other plugins |
| **Distribution** | npm, git, local path |

### Structure

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json           # Required: metadata
├── agents/                   # Optional
│   └── *.md
├── skills/                   # Optional
│   └── */SKILL.md
├── commands/                 # Optional
│   └── *.md
├── hooks/                    # Optional
│   └── hooks-config.json
├── templates/                # Optional
│   └── */
├── patterns/                 # Optional
│   └── *.md
└── README.md                 # Recommended
```

### Examples

- **context-engineering** - Agent + skills for resource creation
- **research-team** - Multiple coordinated research agents

---

## Hook

### When to Use

- **Lifecycle automation** (pre/post tool execution)
- **Tool interception** for filtering or validation
- **Notification** on specific events
- **Code quality** automation (formatting, linting)

### When NOT to Use

- Complex conditional logic (use Agent instead)
- User-triggered actions (use Command instead)
- Content injection (use Skill instead)

### Characteristics

| Aspect | Hook Behavior |
|--------|--------------|
| **Activation** | Event-driven (PreToolUse, PostToolUse, etc.) |
| **Execution** | Shell command or script |
| **Blocking** | PreToolUse can block tool execution |
| **Matchers** | tool_name, file patterns, arg patterns |
| **Security** | Runs with user permissions |

### Structure

```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "matchers": [
        { "tool_name": "Write", "file_path": "*.py" }
      ],
      "command": "black $FILE_PATH"
    }
  ]
}
```

### Events

| Event | Trigger | Can Block |
|-------|---------|-----------|
| PreToolUse | Before tool execution | Yes |
| PostToolUse | After tool execution | No |
| Notification | Custom events | No |
| Stop | Session end | No |

### Examples

- **Auto-format** - Format code after Write/Edit
- **Pre-commit** - Run checks before git commit
- **Security scan** - Block writes to sensitive files

---

## MCP Tool

### When to Use

- **Single utility function** exposed to LLMs via Model Context Protocol
- **Adding a capability** to an existing MCP server
- **Stateless request/response** operations (search, fetch, create, validate)
- **External API wrappers** that an LLM needs to call

### When NOT to Use

- Multiple related tools that share state or config — create an MCP Server instead
- Logic that requires multi-step reasoning — use an Agent instead
- User-triggered workflows — use a Command instead
- Deterministic patterns without external calls — use a Skill instead

### Characteristics

| Aspect | MCP Tool Behavior |
|--------|-------------------|
| **Activation** | LLM tool call via MCP protocol |
| **Execution** | Stateless single request/response |
| **Input** | JSON Schema-validated parameters |
| **Output** | MCP content blocks (text, images) |
| **Transport** | stdio (JSON-RPC) |
| **Distribution** | Part of an MCP server package |

### Structure

```
tools/
└── {tool_name}.py          # FastMCP @mcp.tool() decorated handler
```

Or within a server:
```
my-server/src/my_server/tools/
├── search.py               # Search-related tools
├── create.py               # Create-related tools
└── manage.py               # Management tools
```

### Examples

- **search_documents** - Full-text search across a document store
- **create_issue** - Create a GitHub/GitLab issue from parameters
- **validate_schema** - Validate JSON against a schema
- **fetch_metrics** - Retrieve metrics from a monitoring API

### MCP Tool vs Agent

| Scenario | Use MCP Tool | Use Agent |
|----------|-------------|-----------|
| Single API call with fixed logic | Yes | |
| Multi-step reasoning about results | | Yes |
| Data transformation with clear I/O | Yes | |
| Decision-making between approaches | | Yes |
| Stateless utility function | Yes | |
| Needs conversation history/context | | Yes |

---

## MCP Server

### When to Use

- **2+ related tools** that share configuration, state, or domain
- **Distributing tools** for others to install via `uvx` (Python) or `npx` (TypeScript)
- **Tools that need shared resources** (database connections, API clients, auth tokens)
- **Domain-specific toolkits** (GitHub, database, monitoring, deployment)

### When NOT to Use

- Single utility tool — create a standalone MCP Tool instead
- Claude Code agent, skill, or command — use their respective types
- REST API — MCP is for LLM tool calling, not general HTTP services

### Characteristics

| Aspect | MCP Server Behavior |
|--------|---------------------|
| **Activation** | Started by MCP client (Claude Code, Claude Desktop) |
| **Lifecycle** | Long-running process, handles multiple tool calls |
| **Transport** | stdio (JSON-RPC) — reads stdin, writes stdout |
| **Capabilities** | Tools, Resources, Prompts |
| **Distribution** | `uvx` (Python) or `npx` (TypeScript) |
| **State** | Can maintain state across calls within a session |

### Structure

**Python (FastMCP):**
```
my-server/
├── pyproject.toml          # [project.scripts] for uvx
├── src/my_server/
│   ├── __init__.py
│   ├── server.py           # FastMCP instance + tool imports
│   └── tools/
│       └── search.py       # Tool handlers
├── tests/
│   └── test_tools.py
└── README.md
```

**TypeScript (@modelcontextprotocol/sdk):**
```
my-server/
├── package.json            # bin entry for npx
├── tsconfig.json
├── src/
│   ├── index.ts            # Entry: transport + shutdown
│   ├── server.ts           # Tool registration
│   └── tools/
│       └── search.ts
├── tests/
│   └── tools.test.ts
└── README.md
```

### Python vs TypeScript Decision Factors

| Factor | Choose Python | Choose TypeScript |
|--------|--------------|-------------------|
| **Ecosystem** | Data science, ML, Python APIs | Frontend, Node.js, npm packages |
| **Packaging** | `uvx` / `pip install` | `npx` / `npm install` |
| **Type system** | Type hints + docstrings | Zod schemas (runtime validation) |
| **Existing code** | Python tools to wrap | TypeScript/JS tools to wrap |

### Examples

- [Anthropic MCP Servers](https://github.com/modelcontextprotocol/servers) — Official reference implementations
- `conventions-mcp` — Production TypeScript MCP server (`@ablukis/conventions-mcp`)

---

## Template

### When to Use

- **Reusable output schemas** for generated content
- **Starter patterns** users can copy and customize
- **Code scaffolding** for new projects
- **Report formats** with consistent structure

### When NOT to Use

- Active code generation (use Agent or Skill instead)
- User documentation (put in README/docs instead)
- Configuration (use config files instead)

### Characteristics

| Aspect | Template Behavior |
|--------|------------------|
| **Activation** | Referenced by agents/skills during generation |
| **Execution** | None - pure reference material |
| **Variables** | May include placeholders for substitution |
| **Location** | templates/ directory in plugins |

### Structure

```
templates/
├── report-template/
│   ├── README.md          # How to use this template
│   ├── template.md        # The template with placeholders
│   └── example.md         # Example of filled template
└── code-scaffold/
    ├── README.md
    └── files/
        ├── src/
        │   └── main.py
        ├── tests/
        │   └── test_main.py
        └── pyproject.toml
```

---

## Decision Matrix

Use this matrix to select the right resource type:

| Need | Autonomous? | Multi-turn? | User-triggered? | → Resource |
|------|-------------|-------------|-----------------|------------|
| Domain expertise | Yes | Yes | No | **Agent** |
| Pattern reference | No | No | No | **Skill** |
| User action | No | Maybe | Yes | **Command** |
| Multi-step pipeline | Yes | Yes | Maybe | **Workflow** |
| Component bundle | - | - | - | **Plugin** |
| Event automation | No | No | No | **Hook** |
| Single utility function | No | No | No | **MCP Tool** |
| Multi-tool service | No | No | No | **MCP Server** |
| Reusable structure | No | No | No | **Template** |

### Agent vs Skill: Detailed Comparison

Context is loaded in three levels to minimize token usage:

| Level | Content | Tokens | When Loaded |
|-------|---------|--------|-------------|
| **1. Metadata** | Name + description only | ~30-50/skill | Session start |
| **2. Triggered** | Full SKILL.md | <5,000 | When Claude determines relevance |
| **3. Active** | examples/, templates/, references/ | Variable | On-demand |

**Key insight**: "You can make dozens of Skills available without bloating your context window." ([Progressive Disclosure Pattern](../patterns/progressive-disclosure.md))

| Content Type | Agent? | Skill? | Rationale |
|--------------|--------|--------|-----------|
| Role definition | Yes | No | Core identity, always loaded |
| Multi-turn reasoning | Yes | No | Requires persistent context |
| Tool selection logic | Yes | No | Part of agent orchestration |
| Handoff protocols | Yes | No | Coordination responsibility |
| 2-4 canonical examples | Yes | No | Discovery optimization |
| Multi-page code snippets | No | Yes | Reusable, token-heavy |
| API specifications | No | Yes/Ref | Reference on demand |
| Step-by-step procedures | No | Yes | Deterministic, reusable |
| Domain best practices | No | Yes | Shared across contexts |
| Code templates | No | Yes | Reference when needed |

**Agent length 500-1000+ lines is FINE** as long as content is role/responsibility focused, code snippets are brief (illustrative, not exhaustive), and detailed patterns are referenced not embedded.

### Complex Scenarios

**"I need expertise that activates automatically"**
→ Use **Skill** for context injection, or **Agent** with discovery-optimized description

**"I need a multi-agent pipeline"**
→ Use **Workflow** to define stages, each stage uses an **Agent**

**"I need user-triggered complex reasoning"**
→ Use **Command** that invokes an **Agent**

**"I need to bundle everything for my team"**
→ Create a **Plugin** containing agents, skills, commands

**"I need post-save formatting"**
→ Use **Hook** with PostToolUse event

---

## Multi-Resource Patterns

### Plugin Pattern

When creating a multi-resource plugin:

1. **Identify core capabilities** → Map to agents
2. **Extract shared knowledge** → Map to skills
3. **Define entry points** → Map to commands
4. **Add automation** → Map to hooks
5. **Bundle together** → Create plugin

### Skill Set Pattern

When creating related skills:

1. **Identify base capability** → Core skill
2. **Identify variants** → Variant skills (aws, gcp, azure)
3. **Share common content** → Use references/
4. **Link together** → Same plugin or directory

### Workflow Pattern

When creating a pipeline:

1. **Define stages** → Each stage = one agent
2. **Define artifacts** → Outputs that flow between stages
3. **Define dependencies** → Which stages block others
4. **Add checkpoints** → Where to save state
5. **Add entry command** → How users trigger it

---

## Use Case Examples

Real-world examples showing resource selection reasoning.

### Example 1: Research Team (Multi-Agent Plugin)

**Request**: "Build me a research team"

**Analysis**:
- "team" → Multiple coordinated agents
- "research" → Information gathering workflow
- Needs: Discovery, investigation, synthesis stages

**Result**: Plugin with coordinated agents

```
research-team/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── research-lead.md           # Coordinates, plans research
│   ├── research-specialist.md     # Investigates specific topics
│   └── report-writer.md           # Synthesizes findings
├── skills/
│   └── joplin-research/           # Output formatting patterns
│       └── SKILL.md
└── commands/
    └── research.md                # Entry point: /research [topic]
```

**Why this structure**:
- **Lead orchestrates** → Needs autonomous decision-making about task breakdown → **Agent**
- **Specialists parallelize** → Same capability applied to different topics → **Single agent**, invoked multiple times
- **Report writing is distinct** → Different tools (Write), different output format → **Separate agent**
- **Formatting is reusable** → No decisions, pure patterns for Joplin notes → **Skill**
- **Entry point** → User-triggered start of workflow → **Command**

### Example 2: Domain Expert (Single Agent)

**Request**: "Build me an IaC agent for AWS deployments"

**Analysis**:
- Single domain (IaC + AWS)
- Clear scope, no "team" indicators
- May need supporting knowledge patterns

**Result**: Single agent + supporting skills

```
aws-iac-expert/
├── agents/
│   └── aws-iac-expert.md          # Core IaC expertise
└── skills/
    ├── terraform-patterns/        # Reusable TF module patterns
    │   ├── SKILL.md
    │   └── examples/
    │       ├── vpc-module.md
    │       └── eks-module.md
    └── github-actions/            # CI/CD workflow patterns
        ├── SKILL.md
        └── examples/
            └── terraform-deploy.md
```

**Why this structure**:
- **One domain expert** → AWS + IaC is cohesive, doesn't need separate agents
- **Skills for depth** → Terraform patterns and CI/CD patterns are reusable reference material
- **Progressive disclosure** → Agent references skills; skills load examples on demand

### Example 3: Infrastructure Pipeline (Workflow)

**Request**: "Build me an infrastructure deployment pipeline"

**Analysis**:
- "pipeline" → Multi-stage workflow with state
- Distinct stages with dependencies
- Needs checkpoint and resumption capability

**Result**: Workflow with specialized stage agents

```
deploy-pipeline/
├── workflows/
│   └── deploy-pipeline.yaml       # Stage definitions + dependencies
├── agents/
│   ├── plan-validator.md          # Stage 1: Validate TF plan
│   ├── resource-deployer.md       # Stage 2: Apply changes
│   └── health-checker.md          # Stage 3: Verify deployment
├── commands/
│   └── deploy.md                  # Entry point: /deploy [env]
└── hooks/
    └── hooks-config.json          # Pre-commit TF validation
```

**Workflow definition** (`deploy-pipeline.yaml`):
```yaml
name: deploy-pipeline
stages:
  - name: validate
    agent: plan-validator
    outputs: [plan.json]

  - name: deploy
    agent: resource-deployer
    depends_on: [validate]
    inputs: [plan.json]
    outputs: [deployment-id]

  - name: verify
    agent: health-checker
    depends_on: [deploy]
    inputs: [deployment-id]

checkpoints:
  - after: validate
  - after: deploy
```

**Why this structure**:
- **Workflow orchestration** → Pipeline needs ordered execution with state persistence
- **Separate agents per stage** → Each stage has distinct tools and responsibilities
- **Checkpoint support** → Can resume after failures at stage boundaries
- **Command entry point** → User triggers with `/deploy staging`

### Example 4: Code Quality Automation (Hook + Skill)

**Request**: "Auto-format and lint Python files when I save them"

**Analysis**:
- Automation on file save → Event-driven
- No complex reasoning needed → Not an agent
- Reusable formatting knowledge → Skill for reference

**Result**: Hook with supporting skill

```
python-quality/
├── hooks/
│   └── hooks-config.json          # PostToolUse hook
└── skills/
    └── python-formatting/         # Reference for manual formatting
        ├── SKILL.md
        └── references/
            └── tool-config.md     # pyproject.toml examples
```

**Hook configuration** (`hooks-config.json`):
```json
{
  "hooks": [
    {
      "event": "PostToolUse",
      "matchers": [
        { "tool_name": "Write", "file_path": "*.py" },
        { "tool_name": "Edit", "file_path": "*.py" }
      ],
      "command": "ruff format $FILE_PATH && ruff check --fix $FILE_PATH"
    }
  ]
}
```

**Why this structure**:
- **Hook for automation** → Simple shell command execution on events
- **Skill for reference** → When user asks "how do I configure formatting?" the skill provides guidance
- **No agent needed** → No reasoning or decisions required

---

## Configuration Reference

### ~/.claude Folder Structure

```
~/.claude/
├── CLAUDE.md              # Global instructions (all sessions)
├── settings.json          # Permissions, hooks, enabled plugins
├── commands/              # Custom slash commands (*.md)
├── skills/                # Skills (*/SKILL.md)
├── agents/                # Custom subagents (*.md)
├── hooks/                 # Lifecycle scripts (*.py, *.sh)
├── specs/                 # Language-specific standards (*.md)
├── plugins/               # Plugin installation state
└── lsp-config.lua         # LSP server configuration
```

### CLAUDE.md Hierarchy

Instructions are loaded from lowest to highest priority:

| Priority | Location | Scope | Version Control |
|----------|----------|-------|-----------------|
| 1 (lowest) | `~/.claude/CLAUDE.md` | Global (all sessions) | Personal dotfiles |
| 2 | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Project (team-shared) | Committed |
| 3 | `./CLAUDE.local.md` | Personal project overrides | Gitignored |
| 4 (highest) | `./subdir/CLAUDE.md` | Directory-specific | Optional |

**Best practice**: Put team conventions in `./CLAUDE.md`, personal preferences in `~/.claude/CLAUDE.md`.

### settings.json Structure

```json
{
  "permissions": {
    "allow": [
      "Bash(git:*)",           // All git commands
      "Bash(npm:*)",           // All npm commands
      "Read",                   // File reading
      "Write",                  // File writing
      "Edit"                    // File editing
    ],
    "deny": [
      "Bash(rm -rf *)",        // Dangerous commands
      "Bash(sudo:*)"           // Privileged execution
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matchers": [{ "tool_name": "Write", "file_path": "*.py" }],
        "command": "black $FILE_PATH"
      }
    ]
  },
  "enabledPlugins": {
    "context-engineering": true,
    "research-team": true
  },
  "mcpServers": {
    "memory": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] }
  }
}
```

### Key Configuration Options

| Setting | Purpose | Example |
|---------|---------|---------|
| `permissions.allow` | Whitelist tool patterns | `Bash(git:*)` |
| `permissions.deny` | Blacklist dangerous operations | `Bash(rm -rf *)` |
| `hooks.*` | Lifecycle automation | Auto-format on save |
| `enabledPlugins` | Plugin activation | Enable/disable plugins |
| `mcpServers` | MCP server configuration | Add custom servers |

---

## Quality Checklist

### Agent Quality

- [ ] Discovery-optimized description with examples
- [ ] Focused single responsibility
- [ ] Minimal necessary tool access
- [ ] Clear constraints and boundaries
- [ ] Working code examples

### Skill Quality

- [ ] Specific trigger terms in description
- [ ] Clear "Use for" / "Do NOT use for"
- [ ] Progressive disclosure (SKILL.md → examples/)
- [ ] Patterns with concrete examples
- [ ] Tested autonomous activation

### Command Quality

- [ ] Clear argument documentation
- [ ] Default values for optional args
- [ ] Error handling guidance
- [ ] Usage examples
- [ ] Appropriate allowed_tools

### MCP Tool Quality

- [ ] Tool name uses verb_noun snake_case format
- [ ] Description is 3-4 sentences (what, when to use, when NOT to use, behavior)
- [ ] All parameters have descriptions with format/constraint info
- [ ] Input validation at handler top (fail fast)
- [ ] Error messages include corrective guidance
- [ ] Returns formatted text, not raw data dumps
- [ ] Unit tests for handler (valid input, empty input, error cases)

### MCP Server Quality

- [ ] All tools have proper 3-4 sentence descriptions
- [ ] Packaging configured (pyproject.toml scripts or package.json bin)
- [ ] Graceful shutdown handles SIGINT/SIGTERM
- [ ] All logging goes to stderr (not stdout)
- [ ] README with tool listing and client configuration
- [ ] Unit tests for each tool handler
- [ ] Integration test with MCP client (tools/list works)

### Plugin Quality

- [ ] Complete plugin.json
- [ ] README with installation instructions
- [ ] All components properly namespaced
- [ ] No naming conflicts
- [ ] Documented dependencies

---

## References

### Research Sources

- [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (Anthropic)
- [Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents) (Anthropic)
- [Complete Guide to Claude Skills](https://tylerfolkman.substack.com/p/the-complete-guide-to-claude-skills) (Tyler Folkman)
- [Prompt Engineering Overview](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)

### Templates

- `templates/subagent-template.md` - Agent structure
- `templates/skill-template.md` - Skill structure
- `templates/slash-command-template.md` - Command structure
- `templates/plugin-structure.md` - Plugin layout
- `templates/hook-configuration-template.md` - Hook examples
- `templates/mcp-tool-template.py` - MCP tool pattern
- `templates/mcp-server-python-template/` - Python MCP server scaffold
- `templates/mcp-server-typescript-template/` - TypeScript MCP server scaffold

### Patterns

- `patterns/progressive-disclosure.md` - Token management
- `patterns/multi-agent-orchestration.md` - Agent coordination
- `patterns/tool-restriction-patterns.md` - Security best practices
