# machine-learning

This plugin adds three machine learning specialists, one each for PyTorch, TensorFlow and scikit-learn.

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install machine-learning --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install machine-learning@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **machine-learning**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).

## Try it

- *"Have pytorch-expert find out why the loss in train.py turns to NaN after the third epoch."* The agent checks the gradients, tensor shapes and data pipeline, and proposes a fix.
- *"Use scikit-learn-expert to wrap the preprocessing and model in churn.py in a Pipeline and tune it with cross-validation."* The agent builds the Pipeline and a hyperparameter search over it.
- *"Ask tensorflow-expert to export the model in models/classifier for TensorFlow Serving and TensorFlow Lite."* The agent writes the export code for both targets.

## Agents

Claude Code lists each agent as `machine-learning:<name>`, for example `machine-learning:pytorch-expert`.

| Agent | Use it for |
|---|---|
| `pytorch-expert` | Building, training, debugging and optimizing deep learning models in PyTorch. |
| `tensorflow-expert` | Developing, optimizing and deploying TensorFlow models, including TensorFlow Serving and TensorFlow Lite. |
| `scikit-learn-expert` | scikit-learn: preprocessing, feature engineering, model selection, pipelines, hyperparameter tuning. |

## How the agents work

Claude hands a task to one of these agents when the task matches the agent's description. You can also name the agent in your request, or pick it from `/agents`. Each agent works in its own context window and reports back when it's done, so a long investigation doesn't fill your main conversation. For a one-line question, asking Claude directly is fine.

## Questions

**Do the agents need Context7?** No, but they use it when it's there. Every agent here can call the [Context7](https://context7.com) MCP server to look up current library documentation. Without it, an agent answers from the model's own knowledge, which can lag behind recent releases. To add Context7, run `/plugin install context7@claude-plugins-official`.

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). Common questions are in the [FAQ](../../README.md#faq). MIT license.
