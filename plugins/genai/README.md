# genai

Generative AI application development, starting with LangChain.

Part of the [swe-marketplace](../../README.md) plugin catalog.

## Agents

| Agent | Use it for |
|---|---|
| `genai-langchain-expert` | LangChain and LangGraph: LCEL chains, RAG pipelines, multi-agent systems. |

Claude picks an agent when a task matches its description. You can also ask for one by name ("use genai-langchain-expert to …") or choose it from `/agents`.

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
