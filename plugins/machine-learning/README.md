# machine-learning

Machine learning framework specialists for PyTorch, TensorFlow and scikit-learn.

Part of the [swe-marketplace](../../README.md) plugin catalog.

## Agents

| Agent | Use it for |
|---|---|
| `ml-pytorch-expert` | Building and optimizing deep learning models in PyTorch. |
| `ml-tensorflow-expert` | Developing, optimizing and deploying TensorFlow models. |
| `ml-scikit-learn-expert` | scikit-learn: preprocessing, model selection, pipelines, hyperparameter tuning. |

Claude picks an agent when a task matches its description. You can also ask for one by name ("use ml-pytorch-expert to …") or choose it from `/agents`.

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
