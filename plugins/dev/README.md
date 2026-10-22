# dev

Language specialists for 12 programming languages, plus a cross-language refactoring agent.

Part of the [swe-marketplace](../../README.md) plugin catalog.

## Agents

| Agent | Use it for |
|---|---|
| `dev-python-expert` | Modern Python: async, type safety, FastAPI / Pydantic / SQLAlchemy patterns. |
| `dev-fastapi-architect` | Production FastAPI services: Pydantic v2, async SQLAlchemy 2.0, auth, API design. |
| `dev-typescript-expert` | TypeScript 5.7+: strict typing, generics, type-level programming. |
| `dev-javascript-expert` | Modern JavaScript: async patterns, code quality, performance. |
| `dev-nodejs-expert` | Node.js 22+: ES modules, streams, event-driven architecture, security. |
| `dev-go-expert` | Idiomatic Go: concurrency and performance. |
| `dev-rust-expert` | Idiomatic Rust: ownership, concurrency, the type system. |
| `dev-cpp-expert` | Modern, efficient C++. |
| `dev-kotlin-expert` | Idiomatic Kotlin: coroutines, extension functions, memory. |
| `dev-php-expert` | Modern, secure PHP applications. |
| `dev-lua-expert` | Efficient, idiomatic Lua. |
| `dev-perl-expert` | Perl scripting: regular expressions, text processing, CPAN. |
| `dev-refactor-agent` | Refactoring in any language: structure, naming and duplication, without changing behavior. |

Claude picks an agent when a task matches its description. You can also ask for one by name ("use dev-python-expert to …") or choose it from `/agents`.

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

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **dev**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).
