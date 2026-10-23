# genai

This plugin adds one agent for building LLM applications with LangChain and LangGraph, in Python or TypeScript. It covers LCEL chains, RAG pipelines, vector stores and multi-agent systems.

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install genai --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install genai@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **genai**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).

## Try it

- *"Have langchain-expert build a RAG pipeline over the PDFs in docs/handbook/ with a Chroma vector store."* The agent writes the document loaders, text splitter, embeddings, vector store and retrieval chain.
- *"Should the support bot in bot/agent.py be an LCEL chain or a LangGraph graph?"* The agent compares the two for your flow and recommends one, with the reasons.

## Agents

Claude Code lists the agent as `genai:langchain-expert`.

| Agent | Use it for |
|---|---|
| `langchain-expert` | LangChain and LangGraph in Python or TypeScript: LCEL chains, RAG pipelines, vector stores, multi-agent systems. |

## How the agents work

Claude hands a task to one of these agents when the task matches the agent's description. You can also name the agent in your request, or pick it from `/agents`. Each agent works in its own context window and reports back when it's done, so a long investigation doesn't fill your main conversation. For a one-line question, asking Claude directly is fine.

## Questions

**Do the agents need Context7?** No, but they use it when it's there. The agent can call the [Context7](https://context7.com) MCP server to look up current library documentation. Without it, an agent answers from the model's own knowledge, which can lag behind recent releases. To add Context7, run `/plugin install context7@claude-plugins-official`.

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). Common questions are in the [FAQ](../../README.md#faq). MIT license.
