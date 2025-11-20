# SWE Marketplace

## Overview

This is a plugin marketplace for software development tools in Claude Code. SWE Marketplace follows Anthropic's established convention on how to share Claude Code resources for other developers to discover, use, and contribute to. Claude Code provides built-in tooling to reference a marketplace and can load a variety of resources from it for day-to-day use. Marketplaces can also be used as centralized version control for a team to collaborate and iteratively improve tooling for AI-assisted development. See documentation for more details: 

NOTE: A marketplace can be a remote repository like this one, a private repository, or even a local directory. 

## Features
- **Plugin Discovery** - Browse and search for plugins across categories
- **Version Management** - Track plugin versions and dependencies
- **Developer Tools** - SDK and CLI for plugin development and publishing
- **Ratings & Reviews** - Community-driven plugin evaluation
- **Secure Distribution** - Verified and sandboxed plugin delivery
- **API Access** - Programmatic integration for automation


## Documentation
- **[Plugins Guide](https://code.claude.com/docs/en/plugins)** - Plugin creation, installation, and marketplace management
- **[Plugin Reference](https://code.claude.com/docs/en/plugins-reference)** - Complete manifest schema and specifications
- **[Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)** - Distribution and team configuration

- **[Sub-Agents](https://code.claude.com/docs/en/sub-agents)** - Specialized agent configuration
- **[Skills Documentation](https://code.claude.com/docs/en/skills)** - Creating model-invoked capabilities
- **[Slash Commands](https://code.claude.com/docs/en/slash-commands)** - Custom command structure and syntax
- **[Hooks Guide](https://code.claude.com/docs/en/hooks-guide)** - Event handler configuration



## Other Popular Marketplaces You Can Load & Use

| Repository | Stars | Description |
|---|---|---|
| [wshobson/agents](https://github.com/wshobson/agents) | ⭐ 21,030 | **Arguably, the OG.** First large collection outside of Anthropic that reached popular acclaim. Thank you, Seth! A comprehensive system with 85 specialized AI agents, 15 multi-agent workflow orchestrators, 47 agent skills, and 44 development tools organized into 63 focused plugins. Includes code-documentation, debugging-toolkit, git-pr-workflows, backend-development, and frontend-mobile-development. Optimized for minimal token usage. |
| [EveryInc/every-marketplace](https://github.com/EveryInc/every-marketplace) | ⭐ 725 | Official Every-Env plugin marketplace for Claude Code extensions. |
| [jeremylongshore/claude-code-plugins-plus](https://github.com/jeremylongshore/claude-code-plugins-plus) | ⭐ 468 | Claude Code Plugins Hub with 243 plugins (175 with Agent Skills v1.2.0). First 100% compliant with Anthropic 2025 Skills schema. |
| [ananddtyagi/claude-code-marketplace](https://github.com/ananddtyagi/claude-code-marketplace) | ⭐ 174 | Community-driven marketplace repo for Claude Code plugins. |
| [Dev-GOM/claude-code-marketplace](https://github.com/Dev-GOM/claude-code-marketplace) | ⭐ 23 | Collection of productivity plugins for Claude Code with hooks, commands, and agents for developer workflow automation. |
| [jmanhype/claude-code-plugin-marketplace](https://github.com/jmanhype/claude-code-plugin-marketplace) | ⭐ 5 | Multi-agent trading, swarm intelligence, and GitHub automation plugins. 19 production-grade plugins built from 68+ specialized agents. |
| [kivilaid/plugin-marketplace](https://github.com/kivilaid/plugin-marketplace) | ⭐ 2 | Claude Code plugin marketplace showcasing all component types. |
| [netresearch/claude-code-marketplace](https://github.com/netresearch/claude-code-marketplace) | ⭐ 3 | Curated collection of Claude Code skills developed by Netresearch DTT GmbH. |

There are many other Awesome lists of agents, skills, and slash commands, but these are specifically plugin MARKETPLACES. 


## How Claude Code Plugins Work

### Overview

Claude Code plugins are extensions that enhance functionality through reusable components. Plugins package together custom agents, skills, commands, hooks, and MCP server integrations that can be shared across projects and teams.

### Plugin Components

Plugins can contain five types of components:

| Component | Type | Description |
|-----------|------|-------------|
| **Commands** | User-invoked | Custom slash commands as Markdown files (e.g., `/lint`, `/deploy`) |
| **Agents** | AI-delegated | Specialized sub-agents for specific tasks (e.g., `go-expert`, `k8s-engineer`) |
| **Skills** | Model-invoked | Capabilities Claude autonomously uses based on relevance |
| **Hooks** | Event-triggered | Shell scripts that execute at lifecycle points (e.g., after file writes) |
| **MCP Servers** | Tool integration | External services via Model Context Protocol |


### Using the `/plugin` Command

Manage plugins directly from Claude Code:

```bash
# Interactive menu
/plugin

# Install from marketplace
/plugin install plugin-name@marketplace-name

# List installed plugins
/plugin list

# Remove a plugin
/plugin uninstall plugin-name

# Add a marketplace
/plugin marketplace add <url-or-path>

# View marketplaces
/plugin marketplace list
```

**Example installation:**
1. Use `/plugin` to install marketplace. 
2. Use `/plugin` to select and install a plugin.
3. *Restart Claude Code!*

**Or use:**
```
/plugin install context-engineering@swe-marketplace
```

After installation and restart, verify by running `/help` to see new commands and check `/agents` for new specialized agents.


## Contributing

I will continue incrementally building out more agents for agentic systems and adding them here to make your day a good day. Contributions are also very welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


## Contact

- **Author**: Andis A. Blukis
- **Email**: andis.blukis@gmail.com
- **GitHub**: [@andisab](https://github.com/andisab)
- **LinkedIn**: [andisab](https://www.linkedin.com/in/andisab)

## Roadmap

- [ ] Plugin dependency resolution
- [ ] Automated security scanning
- [ ] CI/CD integration
- [ ] Multi-language support
- [ ] Plugin analytics dashboard
- [ ] Webhook notifications

*Last updated: November 2025* 