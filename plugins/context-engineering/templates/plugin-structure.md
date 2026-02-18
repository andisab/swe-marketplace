# Plugin Structure Template

This template provides the complete directory structure for a Claude Code plugin.

## Directory Structure

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json              # Required: Plugin metadata
├── agents/                      # Optional: Sub-agent definitions
│   ├── agent-one.md
│   ├── agent-two.md
│   └── category/                # Optional: Organize by category
│       └── specialized-agent.md
├── skills/                      # Optional: Skill definitions
│   ├── skill-one/
│   │   ├── SKILL.md            # Required for each skill
│   │   ├── examples/           # Optional: Usage examples
│   │   ├── templates/          # Optional: Code templates
│   │   ├── references/         # Optional: Reference docs
│   │   ├── assets/             # Optional: Static resources (templates, fonts, icons)
│   │   └── scripts/            # Optional: Helper scripts
│   └── skill-two/
│       └── SKILL.md
├── commands/                    # Optional: Slash commands
│   ├── command-one.md
│   ├── command-two.md
│   └── category/               # Optional: Organize by category
│       └── specialized-cmd.md
├── hooks/                       # Optional: Hook configurations
│   └── hooks.json
├── .mcp.json                    # Optional: MCP server integrations
├── .lsp.json                    # Optional: LSP server integrations
├── templates/                   # Optional: General templates
│   ├── code-template-one/
│   └── code-template-two/
├── patterns/                    # Optional: Design patterns
│   ├── pattern-one.md
│   └── pattern-two.md
├── docs/                        # Optional: Documentation
│   ├── getting-started.md
│   └── api-reference.md
├── .gitignore
├── README.md                    # Recommended: User documentation
├── CHANGELOG.md                 # Recommended: Version history
├── LICENSE                      # Recommended: License file
└── CONTRIBUTING.md              # Optional: Contribution guidelines
```

## Required File: .claude-plugin/plugin.json

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Clear, concise description of plugin capabilities",
  "author": {
    "name": "Your Name",
    "email": "email@example.com",
    "url": "https://example.com"
  },
  "homepage": "https://github.com/username/plugin-name",
  "license": "MIT",
  "repository": "https://github.com/username/plugin-name",
  "keywords": [
    "keyword1",
    "keyword2",
    "keyword3",
    "domain",
    "feature"
  ]
  // Optional: component path overrides (supplement default directories)
  // "agents": ["./custom-agents/expert.md"],
  // "skills": ["./custom-skills/capability"],
  // "commands": ["./custom-commands/cmd.md"],
  // "hooks": ["./custom-hooks/hooks.json"],
  // "mcpServers": ["./mcp/server.json"],
  // "lspServers": ["./lsp/server.json"]
}
```

## Recommended: README.md

```markdown
# Plugin Name

Brief description of what this plugin does and who it's for.

## Features

- Feature 1 with brief explanation
- Feature 2 with brief explanation
- Feature 3 with brief explanation

## Installation

### From Claude Code

\`\`\`
/plugin install plugin-name
\`\`\`

### From Git Repository

\`\`\`
/plugin install https://github.com/username/plugin-name.git
\`\`\`

### For Team Projects

Add to `.claude/settings.json`:

\`\`\`json
{
  "plugins": {
    "plugin-name": {
      "source": "github:username/plugin-name",
      "version": "^1.0.0",
      "enabled": true
    }
  }
}
\`\`\`

## Components

### Agents

- **agent-one** - Description of what this agent does
- **agent-two** - Description

### Skills

- **skill-one** - Description and trigger terms
- **skill-two** - Description

### Commands

- `/command-one [args]` - Description
- `/command-two <required> [optional]` - Description

## Usage Examples

### Example 1: [Scenario Name]

\`\`\`
User: [Example request]
Claude: [Response using plugin components]
\`\`\`

### Example 2: [Command Usage]

\`\`\`
/command-name arg1 arg2
\`\`\`

[Explanation of what happens]

## Configuration

Optional configuration in `.claude/settings.json`:

\`\`\`json
{
  "plugin-name": {
    "option1": "custom-value",
    "option2": false
  }
}
\`\`\`

### Available Options

- **option1** (string, default: "default-value") - Description
- **option2** (boolean, default: true) - Description

## Development

### Local Testing

1. Clone this repository
2. Install the plugin locally:
   \`\`\`
   /plugin install /absolute/path/to/plugin-directory
   \`\`\`
3. Test components with sample requests

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

[License Type] - see [LICENSE](LICENSE) file for details.

## Support

- Issues: https://github.com/username/plugin-name/issues
- Discussions: https://github.com/username/plugin-name/discussions
- Documentation: https://github.com/username/plugin-name/wiki

## Credits

Created by [Author Name](https://github.com/username)

### Acknowledgments

- [Contributor 1]
- [Contributor 2]
- [Inspiration or related project]
```

## Recommended: CHANGELOG.md

```markdown
# Changelog

All notable changes to this plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this plugin adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Features in development

### Changed
- Improvements planned

## [1.0.0] - 2025-01-15

### Added
- Initial release
- Agent: agent-one
- Agent: agent-two
- Skill: skill-one
- Command: /command-one
- Command: /command-two

### Documentation
- Complete README with examples
- Installation instructions
- Configuration guide

## [0.1.0] - 2025-01-01

### Added
- Beta release
- Basic agent functionality
- Core skill implementation
```

## Optional: CONTRIBUTING.md

```markdown
# Contributing to [Plugin Name]

Thank you for your interest in contributing!

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/plugin-name.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test locally with `/plugin install /path/to/plugin`
6. Commit with clear messages
7. Push to your fork
8. Open a Pull Request

## Guidelines

### Agents

- Follow single responsibility principle
- Include 2-4 examples in description
- Test discovery with natural language
- Document tool restrictions

### Skills

- Write discovery-optimized descriptions
- Include specific trigger terms
- Provide examples directory
- Test autonomous activation

### Commands

- Clear argument hints
- Document all parameters
- Provide usage examples
- Test with various argument combinations

## Code Style

- Use consistent formatting
- Add comments for complex logic
- Follow existing patterns
- Keep files focused and modular

## Testing

- Test all components locally before submitting
- Verify no conflicts with existing components
- Check cross-platform compatibility
- Include example usage in PR description

## Pull Request Process

1. Update README.md with new features
2. Update CHANGELOG.md following Keep a Changelog format
3. Increment version in plugin.json (semver)
4. Request review from maintainers
5. Address feedback promptly

## Questions?

Open an issue or discussion on GitHub.
```

## .gitignore

```gitignore
# macOS
.DS_Store
.AppleDouble
.LSOverride

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
*.log
logs/

# Temporary files
tmp/
temp/
*.tmp

# Environment
.env
.env.local
.env.*.local

# Dependencies
node_modules/
.npm/
.yarn/

# Build
dist/
build/
*.min.js

# Testing
coverage/
.nyc_output/

# Cache
.cache/
*.cache
```

## Quick Start Checklist

- [ ] Create `.claude-plugin/plugin.json` with metadata
- [ ] Add at least one component (agent, skill, or command)
- [ ] Write README.md with installation instructions
- [ ] Add LICENSE file
- [ ] Create CHANGELOG.md
- [ ] Add .gitignore
- [ ] Test locally with `/plugin install`
- [ ] Initialize git repository
- [ ] Create GitHub repository
- [ ] Tag first version (v1.0.0)
- [ ] Document usage examples
- [ ] (Optional) Create marketplace.json for distribution

## Composability

Plugins should work alongside other plugins without conflict. Design with these principles:

- **Unique naming**: Prefix component names to avoid collisions (e.g., `company-postgres-expert` instead of `postgres-expert`)
- **No exclusivity assumptions**: Don't assume your plugin is the only one loaded; Claude may have 20-50 skills active simultaneously
- **Modular skills**: Each skill within the plugin should handle its specific domain without interfering with others
- **Individual skill directories should NOT include README.md** — `SKILL.md` serves as both definition and documentation

## Next Steps

1. Fill in `plugin.json` with your plugin details
2. Create your first component (agent, skill, or command)
3. Write comprehensive README
4. Test locally
5. Publish to GitHub
6. Share with community or team
