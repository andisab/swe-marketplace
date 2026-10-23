# data

This plugin adds six agents for data visualization, notebooks and data pipelines. They cover D3 and Highcharts charts, Jupyter and Google Colab workflows, R, and Python ETL with Pandas, Polars, PySpark and Airflow.

## Install

In Claude Code (v2.1.275 or later), one step:

```
/plugin install data --marketplace andisab/swe-marketplace
```

Or add the marketplace once, then install by name:

```
/plugin marketplace add andisab/swe-marketplace
/plugin install data@swe-marketplace
```

In Claude Desktop: **Customize → Plugins → Add → Add marketplace**, enter `andisab/swe-marketplace`, then install **data**. Shell commands, team settings, zip upload and claude.ai options are in the [marketplace README](../../README.md#install).

## Try it

- *"Have d3-expert build a zoomable force-directed graph of the service dependencies in deps.json."* The agent writes D3 v7 code for the force simulation, with zoom and drag handlers.
- *"Use the Jupyter expert to parameterize notebooks/churn_analysis.ipynb with Papermill so CI can run it every night."* The agent adds a parameters cell and shows how to run the notebook from a CI job.
- *"Ask python-data-engineer to move the daily orders ETL from Pandas to Polars and schedule it in Airflow."* The agent rewrites the transformations in Polars and writes the Airflow DAG that runs them.

## Agents

Claude Code lists each agent as `data:<name>`, for example `data:d3-expert`.

| Agent | Use it for |
|---|---|
| `d3-expert` | Custom interactive visualizations in D3 v7+: SVG, Canvas, force and hierarchical layouts, maps. |
| `highcharts-expert` | Interactive charts with Highcharts Core, Stock, Maps and Gantt, including React, Vue and Angular integrations. |
| `data-jupyter-expert` | Production-ready Jupyter and JupyterLab notebooks: reproducibility, version control, Papermill parameters, CI. |
| `google-colab-expert` | Google Colab workflows: GPU and TPU sessions, Drive persistence, GitHub integration, Colab's AI features. |
| `data-r-expert` | R for statistics and data science: tidyverse, data.table, tidymodels, Quarto, Shiny. |
| `python-data-engineer` | Python data pipelines and ETL: Pandas, Polars, PySpark, Airflow, warehouse design. |

## How the agents work

Claude hands a task to one of these agents when the task matches the agent's description. You can also name the agent in your request, or pick it from `/agents`. Each agent works in its own context window and reports back when it's done, so a long investigation doesn't fill your main conversation. For a one-line question, asking Claude directly is fine.

## Questions

**Do the agents need Context7?** No, but they use it when it's there. Every agent here except `python-data-engineer` can call the [Context7](https://context7.com) MCP server to look up current library documentation. Without it, an agent answers from the model's own knowledge, which can lag behind recent releases. To add Context7, run `/plugin install context7@claude-plugins-official`.

---

Part of [swe-marketplace](../../README.md). Changes are in the [changelog](../../CHANGELOG.md). Common questions are in the [FAQ](../../README.md#faq). MIT license.
