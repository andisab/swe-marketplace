# Context Engineering

> 🎯 Expert toolkit for creating production-ready Claude Code resources

A comprehensive Claude Code plugin that helps you design and implement high-quality agents, skills, plugins, commands, hooks, and other Claude SDK components following Anthropic's official specifications and best practices.

## Features

### 🤖 Expert Agent
**context-engineer** - Your context engineering specialist that:
- Designs sub-agents with discovery-optimized descriptions
- Creates autonomous skills with proper activation triggers
- Structures complete plugins with proper distribution
- Crafts slash commands with argument handling
- Configures lifecycle hooks for automation
- Uses conventions-mcp to find proven patterns
- Implements progressive disclosure for token efficiency

### 🎓 Five Specialized Skills

Auto-activated skills provide detailed guidance for each resource type:

1. **agent-definition-creation** - Creating sub-agents with proper YAML frontmatter, system prompts, tool access, and example-driven descriptions
2. **skill-creation** - Designing model-invoked capabilities with discovery optimization and supporting file structures
3. **plugin-development** - Building plugin bundles with proper directory structure, metadata, and distribution
4. **command-creation** - Crafting slash commands with arguments, file references, and bash execution
5. **hook-configuration** - Setting up lifecycle event handlers for automation and workflow control

### 📋 Complete Templates

Ready-to-use starting points for every resource type:

- **subagent-template.md** - Agent structure with frontmatter and system prompt
- **skill-template.md** - Skill structure with activation triggers and supporting files
- **plugin-structure.md** - Complete plugin directory layout and configuration
- **slash-command-template.md** - Command patterns with 10 real-world examples
- **hook-configuration-template.md** - 20+ hook configurations for common scenarios

### 🎨 Best Practice Patterns

Documentation of proven architectural patterns:

- **progressive-disclosure.md** - Token management with three disclosure levels (saves 80%+ tokens)
- **multi-agent-orchestration.md** - Coordinating multiple agents for complex workflows
- **tool-restriction-patterns.md** - Security-focused tool access control

## Installation

### Quick Install

```bash
/plugin install context-engineering@swe-marketplace
```

### For Team Projects

Add to `.claude/settings.json`:

```json
{
  "plugins": {
    "context-engineering": {
      "source": "context-engineering@swe-marketplace",
      "enabled": true
    }
  }
}
```

## Usage

### Creating a Sub-Agent

Simply ask Claude:

```
User: "Create an agent for PostgreSQL database optimization"

Claude: I'll use the context-engineer agent to design a comprehensive
        PostgreSQL expert with query optimization, schema design, and performance
        tuning capabilities.
```

The agent will:
1. Ask clarifying questions about domain and capabilities
2. Search conventions-mcp for similar agents
3. Use the agent-definition-creation skill automatically
4. Create proper YAML frontmatter and system prompt
5. Include discovery-optimized examples
6. Select appropriate tools and model

### Creating a Skill

```
User: "I want Claude to automatically process PDF files when I mention them"

Claude: I'll create a skill that activates when you mention PDF processing...
```

The skill-creation skill automatically activates to:
1. Design activation triggers and keywords
2. Structure supporting files (examples/, templates/, references/)
3. Write clear usage instructions
4. Implement progressive disclosure

### Creating a Plugin

```
User: "Help me create a plugin for our deployment workflow with agents, commands, and hooks"

Claude: I'll design a deployment plugin with proper structure...
```

The plugin-development skill handles:
1. Directory organization
2. plugin.json configuration
3. Component coordination
4. Distribution strategy
5. README and documentation

### Creating a Slash Command

```
User: "Make a command that runs tests with different environments"

Claude: I'll create a /run-tests command with environment arguments...
```

The command-creation skill creates:
1. Argument handling ($1, $2, defaults)
2. File references (@file)
3. Bash execution (!command)
4. Tool permissions
5. Help documentation

### Creating Hooks

```
User: "Automatically format Python files after I edit them"

Claude: I'll configure a PostToolUse hook that runs Black and isort...
```

The hook-configuration skill sets up:
1. Event selection (PreToolUse, PostToolUse, etc.)
2. Matchers (tool, file patterns)
3. Shell commands
4. Security validation

## Components

### Agent

- **context-engineer** - Main orchestrator for all resource creation
  - Model: opus (complex reasoning for design decisions)
  - Tools: Read, Write, Edit, Grep, Glob, Bash, MCP (conventions search)
  - Proactive usage for any resource creation request

### Skills

| Skill | Activation Triggers | Purpose |
|-------|-------------------|---------|
| agent-definition-creation | "create agent", "design sub-agent", "make specialist" | Sub-agent development |
| skill-creation | "create skill", "make capability", "autonomous behavior" | Skill development |
| plugin-development | "create plugin", "bundle components", "distribute" | Plugin development |
| command-creation | "create command", "slash command", "add /command" | Command development |
| hook-configuration | "create hook", "automation", "event handler" | Hook configuration |

### Templates

All templates are in `templates/` directory and include:

- Complete structure with frontmatter
- Field explanations and requirements
- Multiple real-world examples
- Best practices and anti-patterns
- Testing guidelines

### Patterns

Architectural documentation in `patterns/` directory:

- **progressive-disclosure.md** (✓ Complete) - Three-level token management
- **multi-agent-orchestration.md** (Pending) - Agent coordination patterns
- **tool-restriction-patterns.md** (Pending) - Security best practices

## Integration with Conventions MCP

This plugin works seamlessly with **conventions-mcp** to:

1. **Search for examples** before creating from scratch
2. **Reference proven patterns** from community and enterprise repos
3. **Learn from existing implementations** in various domains
4. **Avoid reinventing solutions** that already exist

The context-engineer agent automatically searches conventions-mcp when creating resources.

## Progressive Disclosure

This plugin implements progressive disclosure to minimize token usage:

**Level 1 - Metadata** (~60 tokens):
- Component name and type
- Brief description
- Tags and category

**Level 2 - Instructions** (~500-2000 tokens):
- Core capabilities
- Usage guidelines
- Basic examples

**Level 3 - Details** (~5000+ tokens):
- Supporting files loaded on demand
- Comprehensive documentation
- Advanced patterns
- Troubleshooting guides

**Result**: 80%+ token savings on initial load, details available when needed.

## Examples

### Example 1: FastAPI Expert Agent

```
User: "Create an agent for FastAPI development"

Claude uses context-engineer to:
1. Search conventions-mcp for "fastapi agent"
2. Review existing fastapi-architect patterns
3. Design agent with:
   - Async/await expertise
   - Pydantic validation
   - Database integration (SQLAlchemy)
   - API testing patterns
   - Deployment best practices
4. Select tools: Read, Write, Edit, Bash(uvicorn:*)
5. Choose model: sonnet (balanced)
6. Create discovery-optimized description with examples
```

### Example 2: PDF Processing Skill

```
User: "I need Claude to handle PDF extraction automatically"

The skill-creation skill activates to:
1. Design triggers: "PDF", "extract", "form filling", "document parsing"
2. Create SKILL.md with core instructions
3. Structure supporting files:
   - examples/basic-extraction.md
   - examples/form-automation.md
   - templates/pdf-parser.py
   - references/pdf-libraries.md
4. Implement progressive disclosure (load examples on demand)
```

### Example 3: Deployment Plugin

```
User: "Build a deployment plugin for our team"

The plugin-development skill creates:
- .claude-plugin/plugin.json
- agents/deployment-expert.md
- skills/pre-deployment-checks/
- commands/deploy-staging.md
- commands/deploy-production.md
- hooks/ (for automated testing)
- README.md with installation instructions
- Distribution via Git repository
```

## Configuration

Optional configuration in `.claude/settings.json`:

```json
{
  "context-engineering": {
    "useConventionsMCP": true,
    "searchBeforeCreate": true,
    "enableProgressiveDisclosure": true,
    "defaultModel": "sonnet"
  }
}
```

### Available Options

- **useConventionsMCP** (boolean, default: true) - Search conventions-mcp for examples
- **searchBeforeCreate** (boolean, default: true) - Always search before creating new resources
- **enableProgressiveDisclosure** (boolean, default: true) - Use three-level disclosure pattern
- **defaultModel** (string, default: "sonnet") - Default model for created agents

## Best Practices

### When Creating Agents

✅ **Do**:
- Write discovery-optimized descriptions with 2-4 examples
- Use single responsibility principle (one domain per agent)
- Grant minimal necessary tools
- Include concrete usage scenarios
- Test activation with natural language

❌ **Don't**:
- Create multipurpose "helper" agents
- Grant all tools by default
- Use generic descriptions without examples
- Skip testing discovery patterns

### When Creating Skills

✅ **Do**:
- Include specific trigger terms in description
- Structure supporting files in subdirectories
- Implement progressive disclosure
- Test autonomous activation
- Define clear boundaries (what skill does NOT handle)

❌ **Don't**:
- Make skills too broad
- Put everything in SKILL.md
- Use vague activation triggers
- Forget to test with natural language

### When Creating Plugins

✅ **Do**:
- Organize components by domain/capability
- Write comprehensive README
- Include CHANGELOG.md
- Version semantically
- Test with team before distribution

❌ **Don't**:
- Mix unrelated capabilities
- Skip documentation
- Forget plugin.json
- Create naming conflicts

## Development

### Project Structure

```
context-engineering/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── agents/
│   └── context-engineer.md  # Main agent
├── skills/
│   ├── agent-definition-creation/
│   │   ├── SKILL.md
│   │   ├── examples/
│   │   └── references/
│   ├── skill-creation/
│   ├── plugin-development/
│   ├── command-creation/
│   └── hook-configuration/
├── templates/
│   ├── subagent-template.md
│   ├── skill-template.md
│   ├── plugin-structure.md
│   ├── slash-command-template.md
│   └── hook-configuration-template.md
├── patterns/
│   ├── progressive-disclosure.md
│   ├── multi-agent-orchestration.md      # In progress
│   └── tool-restriction-patterns.md      # In progress
└── README.md                    # This file
```

### Contributing

Contributions welcome! Areas for contribution:

1. **More Templates** - Additional resource type templates
2. **Pattern Documentation** - Complete multi-agent-orchestration and tool-restriction patterns
3. **Example Resources** - Reference implementations in various domains
4. **Testing** - Expand test coverage and validation

## Roadmap

### ✅ v1.0.0 - Core Functionality (Current)
- Expert orchestrator agent
- 5 specialized skills
- 5 complete templates
- Progressive disclosure pattern
- Conventions MCP integration

### 🚧 v1.0.1 - Pattern Completion (Next)
- Complete multi-agent-orchestration pattern
- Complete tool-restriction-patterns pattern
- Additional examples in skills/*/examples/

### 📋 v1.1.0 - Enhanced Examples
- 20+ reference agent definitions across domains
- 10+ skill implementations with full supporting files
- 5+ complete plugin examples
- Video tutorials and walkthroughs

### 🔮 v2.0.0 - Advanced Features
- Interactive resource builder
- Visual component design tools
- Automated testing frameworks
- Template customization system

## License

MIT License - see LICENSE file for details

## Credits

**Created by**: [Andis A. Blukis](https://www.linkedin.com/in/andisab)
**Repository**: https://github.com/andisab/swe-marketplace
**Marketplace**: swe-marketplace

### Acknowledgments

- Anthropic for Claude Code and excellent documentation
- Claude Agent SDK team for architecture patterns
- Community contributors to awesome-claude-code-subagents
- Early testers and feedback providers

## Support

- **Issues**: Report bugs or request features
- **Documentation**: See patterns/ directory for detailed guides
- **Examples**: Reference skills/*/examples/ for implementations
- **Templates**: Use templates/ for starting points

## Related Projects

- **conventions-mcp** - MCP server for accessing coding conventions
- **Claude Agent SDK** - Official SDK for building Claude agents
- **awesome-claude-code-subagents** - Community agent collection

---

**Start creating production-ready Claude Code resources with expert guidance!**

```
/plugin install context-engineering@swe-marketplace
```

Then ask Claude:
- "Create an agent for [your domain]"
- "Make a skill for [autonomous capability]"
- "Build a plugin for [your workflow]"
- "Design a command for [common task]"
- "Set up a hook for [automation]"
