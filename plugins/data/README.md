# data

Data science and data engineering specialists: visualization, notebooks, R, and Python data pipelines.

Part of the [swe-marketplace](../../README.md) plugin catalog.

## Agents

| Agent | Use it for |
|---|---|
| `data-d3-expert` | Custom interactive visualizations in D3 v7+: SVG, Canvas, force and hierarchical layouts, maps. |
| `data-highcharts-expert` | Interactive charts with Highcharts Core, Stock, Maps and Gantt. |
| `data-jupyter-expert` | Production-ready Jupyter and JupyterLab notebooks: reproducibility, version control, CI. |
| `data-google-colab-expert` | Google Colab workflows: GPU/TPU sessions, GitHub integration, Colab's AI features. |
| `data-r-expert` | R for statistics and data science: tidyverse, data.table, tidymodels, Quarto. |
| `data-python-data-engineer` | Python data pipelines and ETL: Pandas, Polars, PySpark, Airflow, warehouse design. |

Claude picks an agent when a task matches its description. You can also ask for one by name ("use data-d3-expert to …") or choose it from `/agents`.

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
