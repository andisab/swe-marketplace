

# SWE Marketplace

> Un mercado de plugins de [Claude Code](https://claude.com/claude-code) curado para un uso práctico y diario en ingeniería de software: 13 plugins, 53 agentes especializados, 14 habilidades, 3 comandos. Algunas decisiones de diseño que lo distinguen de las listas "awesome" más grandes:

- **Curado, no exhaustivo.** Cada plugin y agente es uno que realmente uso. Sin bolsas de herramientas agrupadas al azar, sin estarcidos generados automáticamente de habilidades que el modelo ya posee. 
- **Cargable vía SDK.** Cada plugin incluye tanto la entrada del catálogo *como* un `plugin.json` por plugin, para que los consumidores que usan el SDK de Claude Agent (`ClaudeAgentOptions.plugins=[{"type":"local","path":...}]` o `--plugin-dir`) puedan cargarlos directamente. Muchos mercados solo envían el catálogo y fallan silenciosamente al registrar habilidades/comandos/ganchos al cargarlos de esa manera.
- **Desfase protegido por CI.** Una acción de GitHub valida la sincronización del manifiesto en cada PR.
- **Validación sin advertencias.** Cada plugin pasa `claude plugin validate` sin errores ni advertencias. 
- **La mayoría de las habilidades y plugins han pasado por evaluaciones exhaustivas.** Soy un gran fan de skill-creator y tengo un arnés de evaluación personalizado para construir y evaluar plugins. Muchos de los recursos aquí son fruto de ese trabajo. 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Validate plugin manifests](https://github.com/andisab/swe-marketplace/actions/workflows/validate-plugins.yml/badge.svg)](https://github.com/andisab/swe-marketplace/actions/workflows/validate-plugins.yml)
[![Plugins](https://img.shields.io/badge/plugins-13-blue.svg)](./.claude-plugin/marketplace.json)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-8A2BE2.svg)](https://docs.claude.com/en/docs/claude-code/plugins)

## Inicio rápido

```bash
# In Claude Code
/plugin marketplace add https://github.com/andisab/swe-marketplace.git
/plugin install context-engineering@swe-marketplace
# Restart Claude Code, then verify with /help or /agents
```

Explora el catálogo completo con `/plugin` (o `claude plugin marketplace list` desde una terminal). Cada plugin es limpio según `claude plugin validate` y tiene la versión fijada en [`marketplace.json`](./.claude-plugin/marketplace.json).

## Contenido

### [`adv`](./plugins/adv/) — Revisión de código multi-modelo adversarial *(v0.2.0)*

Analiza de forma cruzada los cambios de código usando Claude, Codex CLI y Gemini CLI juntos. Un agente orquesta 5 revisores especializados; tres comandos te permiten hablar con cada modelo directamente.

- **Agente:** `adv-review`
- **Habilidad:** `dispatch` *(infraestructura CLI multi-modelo compartida)*
- **Comandos:** `/adv-codex`, `/adv-gemini`, `/adv-gemini-research`

### [`context-engineering`](./plugins/context-engineering/) — El plugin que usas para construir otros plugins *(v1.1.0)*

Kit de herramientas de extremo a extremo para autorar recursos de Claude Code siguiendo las especificaciones de Anthropic. Plantillas, ejemplos y patrones optimizados para su descubrimiento para cada tipo de componente.

- **Agente:** `context-engineer`
- **Habilidades:** `agent-dev`, `skill-dev`, `command-dev`, `hook-dev`, `plugin-dev`, `mcp-tool-dev`, `mcp-server-dev`

### [`research-team`](./plugins/research-team/) — Orquestación de investigación multi-agente *(v1.2.3)*

Una habilidad `coordinator` descompone un tema en subtemas, genera subagentes `research-specialist` en paralelo y luego transfiere a un `research-report-writer` para la síntesis. Compatible con salida Joplin.

- **Agentes:** `research-specialist`, `research-report-writer`
- **Habilidades:** `coordinator`, `joplin-research`

### [`knowledgeware`](./plugins/knowledgeware/) — Suite de entregables impulsada por estilo *(v1.6.6)*

Suite de entregables impulsada por estilo: presentaciones (PowerPoint o HTML), bases de conocimiento HTML multipágina y diagramas/gráficos de datos (Mermaid, SVG o draw.io) que todos se renderizan desde un registro compartido de marca/estilo. Funciona directamente con 5 estilos integrados; añade tu propia marca una vez y cada entregable coincidirá — configuración y ejemplos en el [README del plugin](./plugins/knowledgeware/README.md).

- **Habilidades:** `slideware`, `knowledgebase`, `chartware`, `brandware`

### [`dev`](./plugins/dev/) — 13 expertos en lenguajes *(v1.0.0)*

| Agente | Enfoque |
|---|---|
| `dev-python-expert` | Python (general) |
| `dev-fastapi-architect` | Diseño de APIs asíncronas / FastAPI |
| `dev-typescript-expert` | TypeScript |
| `dev-javascript-expert` | JavaScript |
| `dev-nodejs-expert` | Node.js |
| `dev-go-expert` | Go |
| `dev-rust-expert` | Rust |
| `dev-cpp-expert` | C++ |
| `dev-kotlin-expert` | Kotlin |
| `dev-php-expert` | PHP |
| `dev-lua-expert` | Lua |
| `dev-perl-expert` | Perl |
| `dev-refactor-agent` | Refactorización entre lenguajes |

### [`frontend`](./plugins/frontend/) — Especialistas en interfaz de usuario y diseño *(v1.0.0)*

- `fe-react-expert`, `fe-vue-expert`, `fe-nextjs-expert`
- `fe-html-expert`, `fe-css-expert`
- `fe-frontend-designer` *(sistemas de diseño, UX)*

### [`infrastructure`](./plugins/infrastructure/) — DevOps, nube y plataforma *(v1.0.0)*

- **Nube:** `infra-aws-architect`, `infra-gcp-architect`
- **Contenedores:** `infra-docker-engineer`, `infra-k8s-engineer`
- **IaC:** `infra-terraform-engineer`
- **CI/CD:** `infra-github-actions-expert`, `infra-gitlab-ci-expert`
- **Seguridad:** `infra-security-auditor`

### [`databases`](./plugins/databases/) — SQL, NoSQL, grafos y vectorial *(v1.0.0)*

`db-postgres-expert`, `db-mongodb-expert`, `db-neo4j-expert`, `db-cassandra-expert`, `db-mariadb-expert`, `db-sql-expert`, `db-vector-expert`

### [`data`](./plugins/data/) — Ciencia de datos e ingeniería de datos *(v1.0.0)*

- **Visualización:** `data-d3-expert`, `data-highcharts-expert`
- **Cuadernos (Notebooks):** `data-jupyter-expert`, `data-google-colab-expert`
- **Lenguajes:** `data-r-expert`, `data-python-data-engineer`

### [`machine-learning`](./plugins/machine-learning/) — Especialistas en frameworks de ML *(v1.0.0)*

`ml-pytorch-expert`, `ml-tensorflow-expert`, `ml-scikit-learn-expert`

### [`genai`](./plugins/genai/) — Desarrollo de IA generativa *(v1.0.0)*

`genai-langchain-expert` — cadenas, agentes, flujos de recuperación. Más frameworks en camino.

### [`product-management`](./plugins/product-management/) — PRDs, contenido y planificación *(v1.0.0)*

`pm-prd-writer`, `pm-content-writer`, `pm-project-planner`

### [`arch`](./plugins/arch/) — Orquestación de sistemas y compilación *(v1.0.0)*

`arch-context-agent` *(gestión de contexto para bases de código grandes)*, `build-orchestrator` *(coordinación de compilación multi-agente)*

## Manifiestos de plugins

Dos manifiestos se envían juntos:

- **`.claude-plugin/marketplace.json`** (raíz del repositorio) — catálogo usado por `/plugin marketplace add` y `/plugin install`. **Fuente de verdad.**
- **`plugins/<name>/.claude-plugin/plugin.json`** — manifiesto por plugin usado por consumidores del SDK que cargan plugins directamente. **Generado** desde la entrada correspondiente en `marketplace.json`.

```bash
python scripts/synthesize-plugin-manifests.py          # regenerate
python scripts/synthesize-plugin-manifests.py --check  # drift check (CI runs this)
./scripts/validate-all.sh                              # full validation
```

Consulta [CONTRIBUTING.md](./CONTRIBUTING.md) para el flujo de contribución completo.

## Otros mercados que valen la pena explorar

| Repositorio | Estrellas (ago. 2026) | Descripción |
|---|---|---|
| [claudemarketplaces.com](https://claudemarketplaces.com/) | ⭐ 20 | Indexa mercados. ¡Gracias, Mert! ([Substack](https://mertbuilds.substack.com/), [Github](https://github.com/mertbuilds)) |
| [wshobson/agents](https://github.com/wshobson/agents) | ⭐ 21,030 | **Probablemente el original (OG).** 185 agentes, 16 orquestadores, 153 habilidades, 100 comandos en 80 plugins. ¡Gracias, Seth! |
| [EveryInc/every-marketplace](https://github.com/EveryInc/every-marketplace) | ⭐ 725 | Mercado oficial de plugins de Every-Env. |
| [jeremylongshore/claude-code-plugins-plus](https://github.com/jeremylongshore/claude-code-plugins-plus) | ⭐ 468 | 243 plugins, el primero 100 % compatible con el esquema Skills 2025 de Anthropic. |
| [ananddtyagi/claude-code-marketplace](https://github.com/ananddtyagi/claude-code-marketplace) | ⭐ 174 | Mercado impulsado por la comunidad. |
| [Dev-GOM/claude-code-marketplace](https://github.com/Dev-GOM/claude-code-marketplace) | ⭐ 23 | Plugins de productividad con ganchos, comandos y agentes. |
| [jmanhype/claude-code-plugin-marketplace](https://github.com/jmanhype/claude-code-plugin-marketplace) | ⭐ 5 | 19 plugins de negociación multi-agente y automatización de GitHub. |
| [kivilaid/plugin-marketplace](https://github.com/kivilaid/plugin-marketplace) | ⭐ 2 | Muestra de cada tipo de componente. |
| [netresearch/claude-code-marketplace](https://github.com/netresearch/claude-code-marketplace) | ⭐ 3 | Habilidades curadas por Netresearch DTT GmbH. |

> **Nota de seguridad:** verifica la fuente de cualquier mercado antes de añadirlo. Los plugins pueden registrar ganchos y servidores MCP que se ejecutan en tu máquina: lee lo que estás ejecutando y revisa los permisos cuidadosamente.

## Documentación

[Guía de plugins](https://code.claude.com/docs/en/plugins) · [Referencia de plugins](https://code.claude.com/docs/en/plugins-reference) · [Mercados](https://code.claude.com/docs/en/plugin-marketplaces) · [Subagentes](https://code.claude.com/docs/en/sub-agents) · [Habilidades](https://code.claude.com/docs/en/skills) · [Comandos slash](https://code.claude.com/docs/en/slash-commands) · [Ganchos (Hooks)](https://code.claude.com/docs/en/hooks-guide)

## Contribuir

Aceptamos contribuciones: ajustes de agentes, nuevos plugins, correcciones de documentación y reportes de errores. Consulta [CONTRIBUTING.md](./CONTRIBUTING.md).

## Licencia

[MIT](./LICENSE) — © Andis A. Blukis.

## Contacto

- **GitHub:** [@andisab](https://github.com/andisab)
- **LinkedIn:** [andisab](https://www.linkedin.com/in/andisab)
- **Email:** andis.blukis@gmail.com
