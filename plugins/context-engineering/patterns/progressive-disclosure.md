# Progressive Disclosure Pattern

## Overview

Progressive Disclosure is a design pattern that minimizes token usage and improves context management by loading information in stages, from minimal metadata to comprehensive detail, only as needed.

## Problem

Claude has a limited context window (200K tokens for Sonnet). Loading all available context upfront:
- Wastes tokens on unused information
- Reduces space for actual work
- Slows initial responses
- Increases cost

## Solution

Structure resources with **three disclosure levels**:

### Level 1: Metadata Only
**Minimal context** - Index information for discovery

**What to include**:
- Name/title
- Type (agent, skill, pattern, etc.)
- 1-sentence description
- Tags for categorization
- File path for retrieval

**Token cost**: ~60 tokens per item

**Use case**: Initial search and discovery

**Example** (conventions-mcp search result):
```json
{
  "name": "postgres-expert",
  "type": "agent",
  "description": "PostgreSQL database expert for query optimization and schema design",
  "tags": ["database", "postgresql", "optimization"],
  "path": "agents/database/postgres-expert.md",
  "tokens": 2500
}
```

### Level 2: Instructions/Overview
**Moderate context** - Enough to understand and decide

**What to include**:
- Core functionality description
- Key capabilities
- Usage instructions
- When to use / when not to use
- Simple examples
- Reference to detailed resources

**Token cost**: ~500-2000 tokens per item

**Use case**: Understanding capabilities before committing

**Example** (skill SKILL.md without supporting files):
```markdown
# Database Migration Skill

## Capabilities
- Create zero-downtime migrations
- Roll back failed changes
- Validate schema compatibility

## Usage
When activated, this skill:
1. Analyzes schema changes
2. Generates migration scripts
3. Provides rollback plans

See `examples/` for detailed workflows
See `templates/` for migration templates
```

### Level 3: Detailed Resources
**Full context** - Complete implementation details

**What to include**:
- Comprehensive documentation
- Detailed examples
- Code templates
- Edge cases
- Troubleshooting guides
- API references
- Supporting scripts

**Token cost**: ~5000-20000 tokens per resource

**Use case**: Actual implementation and problem-solving

**Example** (complete agent system prompt + supporting files):
```markdown
# Complete Agent Definition
- Full system prompt (2000 tokens)
- Detailed examples (3000 tokens)
- Code snippets (5000 tokens)
- Best practices (2000 tokens)
- Edge cases (1000 tokens)
Total: ~13,000 tokens
```

## Implementation Patterns

### For MCP Servers (like conventions-mcp)

**search_conventions** (Level 1):
```typescript
// Return metadata + 250-char preview only
{
  results: [
    {
      title: "...",
      type: "...",
      description: "...",
      preview: "...first 250 chars...",  // ~60 tokens
      path: "...",
      tokenCount: 2500
    }
  ],
  totalTokens: 41000  // Show potential cost
}
```

**get_convention** (Level 2+3):
```typescript
// Return full content only when explicitly requested
{
  title: "...",
  type: "...",
  fullContent: "...",  // Complete resource
  tokenCount: 2500
}
```

### For Skills

**SKILL.md** (Level 2):
```markdown
---
name: skill-name
description: Overview and trigger terms
---

# Main Instructions
Brief, actionable guidance

## Supporting Resources
See `examples/basic.md` for getting started
See `examples/advanced.md` for complex scenarios
See `templates/` for code scaffolding
See `references/api.md` for complete API docs
```

**Supporting Files** (Level 3):
- Load only when referenced
- User or Claude can request: "show me the advanced example"
- Claude loads: `examples/advanced.md` → additional ~2000 tokens

### For Agent Architectures

**Agent Description** (Level 1):
```yaml
description: >
  Brief description with examples (500 tokens)

  Examples show usage patterns but not full implementation
```

**Agent System Prompt** (Level 2):
```markdown
Core responsibilities and approach (1500 tokens)

Reference external docs for detailed patterns
```

**External Resources** (Level 3):
- Link to company wikis
- Reference architecture docs
- Point to code examples
- Load only when needed via tools (Read, WebFetch)

## Best Practices

### 1. Start Small, Expand as Needed

```
❌ Load everything upfront:
Search → Return 50 full conventions (50K tokens)

✅ Progressive loading:
Search → 50 metadata items (3K tokens)
Select → Get 1 full convention (2K tokens)
Implement → Reference supporting files as needed (5K tokens)
Total: 10K vs 50K tokens saved!
```

### 2. Show Token Costs

Help users understand the impact:

```
Search results: 15 conventions found (25,000 tokens total)
⚠️ Loading all would use 12.5% of context window
💡 Use get_convention to load individual conventions
```

### 3. Provide Clear Next Steps

Guide users through disclosure levels:

```
Level 1: "Found 10 matching agents. Use get_convention(path) to view details"
Level 2: "Agent overview loaded. See examples/ for implementation patterns"
Level 3: "Loading examples/advanced-usage.md..."
```

### 4. Cache Common Resources

For frequently accessed items:
- Include in plugin/skill as local files
- Pre-load in agent system prompts
- Reference from memory

### 5. Use References Over Inclusion

```markdown
❌ Include full API docs in skill:
## API Reference
[5000 tokens of API documentation]

✅ Reference external docs:
## API Reference
See `references/api-docs.md` for complete API documentation
Load when needed with Read tool
```

## Real-World Examples

### Example 1: Conventions MCP Search

**User**: "Find agents for database work"

**Level 1** (Metadata search):
```
Found 5 agents:
1. postgres-expert (2500 tokens) - PostgreSQL optimization
2. mongodb-expert (2200 tokens) - MongoDB schema design
3. sql-expert (1800 tokens) - Generic SQL expertise
4. migration-specialist (3000 tokens) - Database migrations
5. vector-db-expert (2400 tokens) - Vector databases

Total if loaded: 11,900 tokens (6% of context)
💡 Use get_convention to load specific agents
```

**Level 2** (User selects postgres-expert):
```
Loading postgres-expert agent...

Core capabilities:
- Query optimization and EXPLAIN plan analysis
- Schema design and normalization
- High availability with replication
- Performance tuning

[Full agent system prompt - 2500 tokens]

Use for:
- Slow query debugging
- Database architecture
- Migration planning
```

**Level 3** (If needed):
- User: "Show me query optimization examples"
- Claude uses Read tool to load examples from agent's documentation

### Example 2: Skill with Supporting Files

**SKILL.md** (1500 tokens):
```markdown
# PDF Processing Skill

Handles PDF extraction, form filling, merging.

## Basic Usage
[Brief instructions - 500 tokens]

## Advanced
See `examples/form-automation.md` for complex workflows
See `templates/pdf-parser.py` for code scaffolding
```

**Progressive Loading**:
1. Skill activates → SKILL.md loaded (1500 tokens)
2. User needs form automation → Claude reads `examples/form-automation.md` (+2000 tokens)
3. User needs template → Claude reads `templates/pdf-parser.py` (+1000 tokens)

Total: 1500 → 3500 → 4500 tokens (vs 4500 upfront)

### Example 3: Agent with External References

**Agent System Prompt**:
```markdown
You are a deployment specialist.

## Core Approach
[Brief methodology - 1000 tokens]

## Detailed Procedures
For specific deployment scenarios, reference:
- Company wiki: https://wiki.company.com/deployments
- Runbooks: file://runbooks/deployment-procedures.md
- Architecture docs: file://docs/architecture.md

Load these with WebFetch or Read tools as needed.
```

**Benefits**:
- Agent prompt stays small (1000 tokens vs 10,000+)
- Always references latest company docs (no stale info)
- Loads full details only when needed

## Token Savings Analysis

### Scenario: Database Toolkit Plugin

**Without Progressive Disclosure**:
- 5 agents × 2500 tokens = 12,500
- 3 skills × 4000 tokens = 12,000
- 10 templates × 1000 tokens = 10,000
- **Total: 34,500 tokens upfront** (17% of 200K context)

**With Progressive Disclosure**:
- Plugin overview: 500 tokens
- Agent metadata (5): 300 tokens
- Skill metadata (3): 180 tokens
- **Initial load: 980 tokens** (0.5% of context)

- User selects 1 agent: +2,500 tokens
- User activates 1 skill: +1,500 tokens
- User requests 2 templates: +2,000 tokens
- **Actual usage: 6,980 tokens** (3.5% of context)

**Savings**: 34,500 - 6,980 = **27,520 tokens saved** (80% reduction!)

## Implementation Checklist

When designing resources for progressive disclosure:

- [ ] Separate metadata from content
- [ ] Write concise descriptions (1-2 sentences)
- [ ] Include token counts in metadata
- [ ] Structure supporting files in separate directories
- [ ] Reference rather than include detailed docs
- [ ] Show users token costs before loading
- [ ] Provide clear navigation between levels
- [ ] Cache or index common resources
- [ ] Test token usage with real queries
- [ ] Document the disclosure pattern for users

## Anti-Patterns to Avoid

❌ **Loading everything "just in case"**
```python
# Load all agents upfront
for agent in all_agents:
    load_full_content(agent)  # 50K tokens!
```

❌ **Duplicating content at multiple levels**
```markdown
# Level 1: Full agent definition (2500 tokens)
# Level 2: Same full agent definition again (2500 tokens)
Total waste: 2500 tokens
```

❌ **No clear path between levels**
```
User: "Show me database agents"
Response: [Returns metadata with no indication how to get more]
```

❌ **Ignoring user's actual needs**
```
User: "I need the postgres-expert agent"
Response: [Loads all 50 agents because user mentioned one]
```

## Key Takeaways

1. **Three levels**: Metadata → Instructions → Details
2. **Load on demand**: Only retrieve what's actually needed
3. **Show costs**: Help users understand token usage
4. **Clear navigation**: Guide users through disclosure levels
5. **Reference over include**: Link to details rather than embedding
6. **Measure impact**: Track token savings with real usage patterns

Progressive disclosure is about **respecting the context window** - give users the information they need, when they need it, and no more.
