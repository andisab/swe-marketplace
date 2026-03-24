# Skill-MCP Integration Pattern

This pattern documents how skills serve as a knowledge and workflow layer on top of MCP tool access, based on Anthropic's official guidance (January 2026).

## Overview

### The Kitchen Analogy

MCP provides the **professional kitchen**: access to tools, ingredients, and equipment. It connects Claude to your services (Notion, Linear, Sentry, Slack, etc.) and provides real-time data access and tool invocation. MCP answers the question: *what can Claude do?*

Skills provide the **recipes**: step-by-step instructions on how to create something valuable. They capture workflows, best practices, and domain expertise so Claude can apply them consistently. Skills answer the question: *how should Claude do it?*

Together, they enable users to accomplish complex tasks without needing to figure out every step themselves.

### Why This Matters

**Without skills** (MCP only):
- Users connect MCP but don't know what to do next
- Each conversation starts from scratch
- Inconsistent results because users prompt differently each time
- Support tickets asking "how do I do X with your integration"
- Users blame the connector when the real issue is workflow guidance

**With skills** (MCP + skill layer):
- Pre-built workflows activate automatically when needed
- Consistent, reliable tool usage across sessions
- Best practices embedded in every interaction
- Lower learning curve for the integration
- Users accomplish tasks on first try


## When to Create an MCP Enhancement Skill

Create a skill on top of MCP when:

- **Users don't know what to do**: They have the MCP connected but need guidance on workflows
- **Results are inconsistent**: Different users get different quality results for the same task
- **Multi-step coordination is needed**: The workflow requires calling multiple MCP tools in sequence with logic between them
- **Domain expertise is required**: Users need specialized knowledge (compliance rules, best practices, institutional conventions) to use the tools effectively
- **You want to reduce support burden**: Common "how do I..." questions can be answered by the skill itself

**Raw MCP is sufficient when**:
- Users are experienced and know the tool well
- The task is a single tool call with obvious parameters
- No workflow coordination is needed
- No domain expertise beyond what users already have


## Integration Patterns

### Pattern 1: Single-MCP Enhancement

A skill wraps one MCP server with best-practice workflows.

**Use when**: You have a single MCP server and want to teach Claude the optimal way to use it.

```yaml
---
name: sentry-code-review
description: >
  Automatically analyzes and fixes detected bugs in GitHub Pull Requests
  using Sentry's error monitoring data via MCP. Use when user mentions
  "Sentry bugs", "error analysis", or "fix monitoring issues".
  Do NOT use for Sentry configuration or alert setup.
metadata:
  mcp-server: sentry
  category: mcp-enhancement
---

# Sentry Code Review

## Workflow
1. Fetch recent errors from Sentry MCP
2. Correlate errors with current PR changes
3. Analyze root causes using stack traces
4. Suggest code fixes with explanations
5. Verify fixes don't introduce regressions
```

**Key techniques**:
- Reference specific MCP tool names in instructions
- Embed domain expertise (error analysis patterns)
- Include error handling for MCP unavailability

### Pattern 2: Multi-MCP Coordination

A skill orchestrates workflows across multiple MCP services.

**Use when**: A workflow spans multiple services that need to be coordinated.

```yaml
---
name: sprint-planning
description: >
  End-to-end sprint planning. Fetches project status from Linear,
  analyzes team velocity, creates tasks, and notifies Slack. Use when
  user says "plan sprint", "create sprint tasks", or "sprint setup".
  Do NOT use for retrospectives or sprint reviews.
metadata:
  mcp-server: linear, slack
  category: workflow
---

# Sprint Planning Workflow

## Phase 1: Gather Context (Linear MCP)
1. Fetch current project status
2. Analyze team velocity from recent sprints
3. Review backlog priorities

## Phase 2: Plan Sprint (Linear MCP)
1. Suggest task prioritization based on velocity
2. Create tasks with proper labels and estimates
3. Assign to team members

## Phase 3: Notify Team (Slack MCP)
1. Post sprint summary to #engineering
2. Include task links and assignments
```

**Key techniques**:
- Clear phase separation with explicit MCP attribution
- Data passing between phases (velocity data informs task creation)
- Validation before moving to next phase

### Pattern 3: MCP + Local Tool Hybrid

A skill combines MCP tools with Claude's built-in capabilities.

**Use when**: Some steps use MCP tools and others use local capabilities (file creation, code execution, analysis).

```yaml
---
name: data-report
description: >
  Generate data reports by fetching live data via MCP and producing
  formatted documents locally. Use when user requests "data report",
  "analytics summary", or "generate dashboard data".
  Do NOT use for real-time monitoring or alert setup.
metadata:
  mcp-server: analytics-service
  category: document
---

# Data Report Generation

## Step 1: Fetch Data (Analytics MCP)
1. Query metrics via MCP tools
2. Fetch comparison data from previous period

## Step 2: Analyze (Local)
1. Calculate trends and anomalies
2. Generate visualizations using code execution

## Step 3: Create Report (Local)
1. Format into structured document
2. Apply brand templates from `assets/report-template.md`
3. Save final report
```


## Description Writing for MCP Skills

When writing the `description` field for MCP-enhanced skills:

1. **Include the MCP server name in metadata** — use the `mcp-server` field so Claude and users know which integration is required
2. **Reference specific workflows, not tools** — describe what users want to accomplish, not which MCP functions get called
3. **Handle MCP unavailability gracefully** — in the skill body, include instructions for what to do if the MCP server is not connected
4. **Include negative triggers** — explicitly state what the skill does NOT handle to prevent over-activation on adjacent MCP-related queries


## Composability & Portability

**Composability**: Skills should work alongside other skills. Do not assume your skill is the only capability loaded. Claude can activate multiple skills simultaneously (up to 20-50 concurrently). Design skills to be modular — each skill handles its specific domain without interfering with others.

**Portability**: Skills work identically across Claude.ai, Claude Code, and API. Create a skill once and it works across all surfaces without modification, provided the environment supports any dependencies the skill requires. Note platform-specific requirements in the `compatibility` field if needed.

**For MCP builders**: Skills add a powerful layer to your MCP integration. When distributing skills alongside your MCP server:
- Host on GitHub with a clear repo-level README (separate from the skill folder)
- Link to skills from your MCP documentation
- Explain the value of using MCP + skills together
- Provide a quick-start guide for installation


## Resources

- `skills/skill-dev/SKILL.md` - Complete skill creation reference with 5 canonical patterns
- `templates/skill-template.md` - Starting template for new skills
- `patterns/progressive-disclosure.md` - Token management with three disclosure levels
- Anthropic's "The Complete Guide to Building Skills for Claude" (January 2026)
