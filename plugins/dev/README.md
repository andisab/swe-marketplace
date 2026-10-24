# dev

This plugin adds specialists for ten programming languages, plus FastAPI and Node.js specialists and an agent that refactors code in any language without changing what it does. The languages are Python, TypeScript, JavaScript, Go, Rust, C++, Kotlin, PHP, Lua and Perl.

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install dev --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install dev@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **dev**. Shell commands, team settings, zip upload and claude.ai options are in the marketplace's [install guide](../../docs/install.md).

## Try it

- *"Have python-expert convert the database calls in app/repositories/ to async SQLAlchemy 2.0."* The agent rewrites the calls with async sessions and points out the callers that need to change too.
- *"Use typescript-expert to turn on strict mode in packages/web and fix the type errors."* The agent enables `strict` in `tsconfig.json` and fixes the errors file by file.
- *"Ask refactor-agent to split OrderService.process() into smaller functions without changing its behavior."* The agent restructures the code and keeps its inputs and outputs the same. It can't run your tests, so run them afterwards.

## Agents

Claude Code lists each agent as `dev:<name>`, for example `dev:python-expert`.

| Agent | Use it for |
|---|---|
| `python-expert` | Modern Python: async, type hints, protocols, and FastAPI, Pydantic and SQLAlchemy 2.0 patterns. |
| `fastapi-architect` | Production FastAPI services: Pydantic v2, async SQLAlchemy 2.0, JWT auth, API design. |
| `typescript-expert` | TypeScript 5.7+: strict typing, generics, type-level programming. |
| `javascript-expert` | Modern JavaScript: async patterns, debugging, performance. |
| `nodejs-expert` | Node.js 22+: ES modules, streams, clustering, event-driven architecture, security. |
| `go-expert` | Idiomatic Go: concurrency and performance. |
| `rust-expert` | Idiomatic Rust: ownership and borrowing, concurrency, the type system. |
| `cpp-expert` | Modern, efficient C++. |
| `kotlin-expert` | Idiomatic Kotlin: coroutines, extension functions, memory management. |
| `php-expert` | Modern, secure PHP applications. |
| `lua-expert` | Efficient, idiomatic Lua. |
| `perl-expert` | Perl scripting: regular expressions, text processing, CPAN. |
| `refactor-agent` | Refactoring in any language: structure, naming, duplication and complex logic, without changing behavior. |

## How the agents work

Claude hands a task to one of these agents when the task matches the agent's description. You can also name the agent in your request, or pick it from `/agents`. Each agent works in its own context window and reports back when it's done, so a long investigation doesn't fill your main conversation. For a one-line question, asking Claude directly is fine.

## Questions

**Can refactor-agent run my tests?** No. It can read and edit files, but it has no Bash tool, so it can't run commands. Run your tests after it finishes.

**Do the agents need Context7?** No, but they use it when it's there. Every agent here except `fastapi-architect` and `refactor-agent` can call the [Context7](https://context7.com) MCP server to look up current library documentation. Without it, an agent answers from the model's own knowledge, which can lag behind recent releases. To add Context7, run `/plugin install context7@claude-plugins-official`.

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). Common questions are in the [FAQ](../../README.md#faq). MIT license.
