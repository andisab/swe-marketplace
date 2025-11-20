---
name: plugin-development
description: >
  Use this skill when creating or refining Claude Code plugins. Plugins are bundled collections
  of agents, skills, commands, hooks, and MCP servers that provide cohesive functionality. Helps
  design proper directory structures, plugin.json configuration, marketplace distribution, and
  installation workflows. Automatically invoked when user requests "create a plugin", "bundle
  components", "distribute capabilities", or mentions plugin development.
allowed-tools: Read, Write, Edit, Bash(mkdir:*), Bash(tree:*), Grep, Glob
---

# Plugin Development Skill

This skill helps create production-ready Claude Code plugins following Anthropic's official plugin specifications.

## What is a Plugin?

A plugin is a **bundled collection** of Claude Code components that work together to provide cohesive functionality. Plugins enable:

- **Modular distribution**: Package related capabilities together
- **Team sharing**: Install once across multiple projects
- **Version management**: Track plugin versions independently
- **Marketplace discovery**: Publish for community use
- **Automatic updates**: Keep components synchronized

## Plugin vs Individual Components

| Approach | When to Use |
|----------|-------------|
| **Individual Components** | Single capability, personal use, experimental |
| **Plugin** | Multiple related components, team distribution, reusable across projects |

**Example - Individual approach**:
- `.claude/agents/postgres-expert.md` (one file)
- `.claude/commands/test.md` (one file)

**Example - Plugin approach**:
- `database-toolkit/` plugin containing:
  - Agents: postgres-expert, mongodb-expert, sql-expert
  - Skills: migration-management, query-optimization
  - Commands: /migrate, /db-status
  - Templates: schema templates

## Plugin Structure

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json              # Required: Plugin metadata
├── agents/                      # Optional: Sub-agent definitions
│   ├── agent-one.md
│   └── agent-two.md
├── skills/                      # Optional: Skill definitions
│   ├── skill-one/
│   │   ├── SKILL.md
│   │   └── examples/
│   └── skill-two/
│       └── SKILL.md
├── commands/                    # Optional: Slash commands
│   ├── command-one.md
│   └── subfolder/
│       └── command-two.md
├── hooks/                       # Optional: Hook configurations
│   └── hooks-config.json
├── mcp/                         # Optional: MCP server integrations
│   └── server-config.json
├── templates/                   # Optional: Code templates
│   └── template-files/
├── patterns/                    # Optional: Design patterns
│   └── pattern-docs/
├── README.md                    # Recommended: Plugin documentation
└── LICENSE                      # Recommended: License file
```

## plugin.json Configuration

**Required file**: `.claude-plugin/plugin.json`

```json
{
  "name": "database-toolkit",
  "version": "1.0.0",
  "description": "Comprehensive database management toolkit with experts for PostgreSQL, MongoDB, and SQL",
  "author": "Your Name <email@example.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/username/database-toolkit"
  },
  "keywords": [
    "database",
    "postgresql",
    "mongodb",
    "sql",
    "migration",
    "optimization"
  ],
  "engines": {
    "claude-code": ">=2.0.0"
  },
  "dependencies": {
    "other-plugin": "^1.2.0"
  }
}
```

### Field Specifications

**name** (required)
- Unique plugin identifier
- Lowercase, alphanumeric, hyphens
- Example: `database-toolkit`, `api-testing-suite`

**version** (required)
- Semantic versioning: `MAJOR.MINOR.PATCH`
- Example: `1.0.0`, `2.3.1-beta`

**description** (required)
- Clear explanation of plugin capabilities
- 1-3 sentences
- Include key features

**author** (required)
- Name and email: `"Name <email@example.com>"`
- Organization: `"Company Name"`

**license** (recommended)
- SPDX identifier: `MIT`, `Apache-2.0`, `GPL-3.0`
- Or `"SEE LICENSE IN <filename>"`

**repository** (recommended)
- Version control information
- Helps users find source code
- Enables issue tracking

**keywords** (optional)
- Searchable terms for marketplace discovery
- Array of strings
- 5-10 relevant keywords

**engines** (optional)
- Minimum Claude Code version required
- Semantic version range: `">=2.0.0"`, `"^2.1.0"`

**dependencies** (optional)
- Other plugins this plugin requires
- Semantic version ranges

## Directory Organization Patterns

### Single-Purpose Plugin
Focused on one domain with minimal structure.

```
database-migration/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── migration-expert.md
├── skills/
│   └── schema-evolution/
│       └── SKILL.md
├── commands/
│   ├── migrate.md
│   └── rollback.md
└── README.md
```

### Multi-Component Plugin
Comprehensive toolkit with multiple agents and capabilities.

```
full-stack-toolkit/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── backend/
│   │   ├── fastapi-expert.md
│   │   └── nodejs-expert.md
│   ├── frontend/
│   │   ├── react-expert.md
│   │   └── nextjs-expert.md
│   └── database/
│       └── postgres-expert.md
├── skills/
│   ├── api-testing/
│   ├── deployment/
│   └── monitoring/
├── commands/
│   ├── dev/
│   │   ├── start-dev.md
│   │   └── run-tests.md
│   └── deploy/
│       └── production-deploy.md
├── templates/
│   ├── api-endpoint/
│   ├── react-component/
│   └── database-schema/
└── README.md
```

### Plugin with MCP Integration
Includes external tool integrations.

```
devops-toolkit/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── docker-expert.md
│   └── k8s-expert.md
├── mcp/
│   ├── docker-cli/
│   │   └── config.json
│   └── kubectl/
│       └── config.json
├── skills/
│   └── container-orchestration/
└── README.md
```

## Installation Methods

### User Installation

**Interactive interface**:
```
/plugin
```
Opens plugin browser with search and installation UI.

**Direct installation**:
```
/plugin install plugin-name@marketplace-name
```

**From local path**:
```
/plugin install /path/to/plugin-directory
```

**From Git URL**:
```
/plugin install https://github.com/user/plugin-name.git
```

### Project-Level Installation (Automatic for Team)

Configure in `.claude/settings.json`:

```json
{
  "plugins": {
    "database-toolkit": {
      "source": "github:username/database-toolkit",
      "version": "^1.0.0",
      "enabled": true
    },
    "local-plugin": {
      "source": "file:../plugins/local-plugin",
      "enabled": true
    }
  }
}
```

**Benefits**:
- Team members auto-install plugins on project clone
- Version-controlled plugin configuration
- Consistent development environment

## Marketplace Distribution

### Creating a Marketplace

**marketplace.json** format:

```json
{
  "name": "company-plugins",
  "description": "Internal company plugin marketplace",
  "plugins": [
    {
      "name": "database-toolkit",
      "description": "Database management toolkit",
      "version": "1.0.0",
      "source": "github:company/database-toolkit",
      "author": "Company DevOps",
      "keywords": ["database", "postgresql", "migration"]
    },
    {
      "name": "api-testing",
      "description": "API testing and validation suite",
      "version": "2.1.0",
      "source": "github:company/api-testing",
      "author": "Company QA",
      "keywords": ["testing", "api", "validation"]
    }
  ]
}
```

### Adding Marketplace

Users add your marketplace:

```
/plugin marketplace add https://company.com/plugins/marketplace.json
```

Or from local file:

```
/plugin marketplace add file:///path/to/marketplace.json
```

### Publishing Workflow

1. **Develop plugin locally**:
   ```bash
   cd plugins/my-plugin
   # Create .claude-plugin/plugin.json
   # Add agents, skills, commands
   # Test locally
   ```

2. **Create repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial plugin release"
   git tag v1.0.0
   git push origin main --tags
   ```

3. **Add to marketplace**:
   ```json
   {
     "plugins": [{
       "name": "my-plugin",
       "source": "github:username/my-plugin",
       "version": "1.0.0"
     }]
   }
   ```

4. **Announce and distribute**:
   - Share marketplace URL
   - Document in README
   - Provide installation instructions

## Component Organization Best Practices

### Agents
Group related agents by domain:

```
agents/
├── database/
│   ├── postgres-expert.md
│   └── mongodb-expert.md
├── api/
│   ├── rest-api-expert.md
│   └── graphql-expert.md
└── infrastructure/
    ├── docker-expert.md
    └── k8s-expert.md
```

### Skills
Organize by capability:

```
skills/
├── data-processing/
│   ├── SKILL.md
│   └── examples/
├── api-testing/
│   ├── SKILL.md
│   └── templates/
└── deployment-automation/
    ├── SKILL.md
    └── scripts/
```

### Commands
Group by workflow or domain:

```
commands/
├── development/
│   ├── start-dev.md
│   ├── run-tests.md
│   └── lint-code.md
├── database/
│   ├── migrate.md
│   └── seed-data.md
└── deployment/
    ├── deploy-staging.md
    └── deploy-production.md
```

## Testing Your Plugin

### Local Testing

1. **Install plugin locally**:
   ```
   /plugin install /absolute/path/to/plugin-directory
   ```

2. **Verify components loaded**:
   ```
   /agents          # Check agents available
   /commands        # Check commands available
   ```

3. **Test each component**:
   - Agents: Request tasks that should invoke them
   - Skills: Trigger with natural language
   - Commands: Execute slash commands
   - Hooks: Verify event triggers work

4. **Check for conflicts**:
   - Name collisions with existing components
   - Tool access issues
   - Dependency problems

### Team Testing

1. **Add to project settings**:
   ```json
   {
     "plugins": {
       "test-plugin": {
         "source": "file:../plugins/test-plugin",
         "enabled": true
       }
     }
   }
   ```

2. **Have team members clone project**:
   ```bash
   git clone project-repo
   # Plugin auto-installs
   ```

3. **Collect feedback**:
   - Component discovery issues
   - Missing capabilities
   - Documentation clarity
   - Installation problems

## Version Management

### Semantic Versioning

Follow [semver](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
  - Remove components
  - Change command syntax
  - Incompatible updates

- **MINOR** (1.0.0 → 1.1.0): New features (backward compatible)
  - Add new agents/skills
  - Add new commands
  - Enhance existing features

- **PATCH** (1.0.0 → 1.0.1): Bug fixes
  - Fix agent prompts
  - Correct command syntax
  - Update documentation

### Changelog

Maintain CHANGELOG.md:

```markdown
# Changelog

## [1.1.0] - 2025-01-15

### Added
- New mongodb-expert agent
- /db-backup command

### Changed
- Improved postgres-expert query optimization

### Fixed
- Migration skill path resolution bug

## [1.0.0] - 2025-01-01

### Added
- Initial release
- postgres-expert agent
- schema-evolution skill
```

## README Template

```markdown
# Plugin Name

Brief description of plugin capabilities.

## Features

- Feature 1
- Feature 2
- Feature 3

## Installation

\`\`\`
/plugin install plugin-name
\`\`\`

Or add to project `.claude/settings.json`:

\`\`\`json
{
  "plugins": {
    "plugin-name": {
      "source": "github:username/plugin-name",
      "version": "^1.0.0"
    }
  }
}
\`\`\`

## Components

### Agents
- **agent-one**: Description
- **agent-two**: Description

### Skills
- **skill-one**: Description
- **skill-two**: Description

### Commands
- `/command-one`: Description
- `/command-two`: Description

## Usage Examples

### Example 1
\`\`\`
User: Request example
Claude: Uses component to handle request
\`\`\`

### Example 2
\`\`\`
/command-example arg1 arg2
\`\`\`

## Configuration

Optional configuration in `.claude/settings.json`:

\`\`\`json
{
  "plugin-name": {
    "option1": "value1"
  }
}
\`\`\`

## License

MIT

## Contributing

Contributions welcome! See CONTRIBUTING.md.
```

## Common Mistakes to Avoid

❌ **Missing plugin.json**
```
plugin-name/
├── agents/
└── README.md              # No .claude-plugin/plugin.json
```

✅ **Proper structure**
```
plugin-name/
├── .claude-plugin/
│   └── plugin.json        # Required
├── agents/
└── README.md
```

❌ **Unversioned plugin**
```json
{
  "name": "my-plugin"
  // Missing "version" field
}
```

✅ **Properly versioned**
```json
{
  "name": "my-plugin",
  "version": "1.0.0"
}
```

❌ **No documentation**
```
plugin-name/
├── .claude-plugin/
└── agents/                # No README explaining usage
```

✅ **Well-documented**
```
plugin-name/
├── .claude-plugin/
├── agents/
├── README.md              # Installation and usage guide
└── CHANGELOG.md           # Version history
```

❌ **Conflicting component names**
```
plugin-name/agents/postgres-expert.md
# Conflicts with user's existing postgres-expert agent
```

✅ **Unique naming**
```
plugin-name/agents/company-postgres-expert.md
# Prefixed to avoid conflicts
```

## Advanced Features

### Plugin Dependencies

Reference other plugins:

```json
{
  "name": "advanced-toolkit",
  "dependencies": {
    "database-toolkit": "^1.0.0",
    "api-testing-suite": "^2.1.0"
  }
}
```

### Conditional Loading

Load components based on project type:

```json
{
  "name": "full-stack-toolkit",
  "conditions": {
    "hasFile": ["package.json"],
    "environment": ["development", "staging"]
  }
}
```

### Configuration Schema

Define expected configuration:

```json
{
  "name": "deployment-toolkit",
  "configSchema": {
    "environments": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "url": {"type": "string"}
        }
      }
    }
  }
}
```

## Resources

Reference the examples directory for:
- Complete plugin structures across different scales
- plugin.json configurations for various use cases
- Marketplace setup and distribution patterns
- Multi-component organization strategies

---

**Next Steps**: After creating a plugin, test locally with `/plugin install /path/to/plugin`, gather feedback from team members, version appropriately, and distribute via marketplace or Git repository.
