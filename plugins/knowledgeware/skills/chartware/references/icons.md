# Icons for SVG diagrams

`templates/svg/icons.svg` holds 96 `<symbol>` definitions on a 24-unit grid, all drawn in `currentColor`: 63 outline icons from [Tabler Icons](https://tabler.io/icons) 3.49.0 (MIT) and 33 brand marks from [Simple Icons](https://simpleicons.org) 16.35.0 (CC0 1.0; the trademarks belong to their owners, so use a brand mark only to denote that product). `scripts/build-icons.py` regenerates the sprite from the npm packages; edit its two lists to add icons.

## Using an icon in a diagram

Copy the `<symbol>` you need from the sprite into the diagram's own `<defs>` (inline SVG can't reference another file's symbols, and `<img>`-embedded SVG can't reach the page's), then place it with `<use>`. Colour comes from `currentColor`, so set `color` on the `<use>` or its group and it follows the theme:

```svg
<defs>
  <symbol id="cwi-database" viewBox="0 0 24 24" fill="none" stroke="currentColor" ...>…</symbol>
</defs>
<g class="node-icon" style="color:var(--cw-muted)">
  <use href="#cwi-database" x="112" y="100" width="20" height="20"/>
</g>
```

Sizes: 20 units beside a 13px label inside a card, 16 in a chip, 28–32 as the only content of a compact node. Keep the icon in the muted tone and let the stroke of the node carry identity; an icon in the accent counts as one of the two accent roles. One outline icon per node at most, and never an outline icon next to a brand mark in the same node.

The lint (`scripts/svg-lint.py`) reports a `<use>` whose `href` names a symbol the file doesn't define.

## Catalog

| Symbol | Kind | Source |
|---|---|---|
| `cwi-server` | outline | Tabler Icons |
| `cwi-server-2` | outline | Tabler Icons |
| `cwi-database` | outline | Tabler Icons |
| `cwi-cloud` | outline | Tabler Icons |
| `cwi-cloud-upload` | outline | Tabler Icons |
| `cwi-cpu` | outline | Tabler Icons |
| `cwi-container` | outline | Tabler Icons |
| `cwi-topology-star-3` | outline | Tabler Icons |
| `cwi-network` | outline | Tabler Icons |
| `cwi-router` | outline | Tabler Icons |
| `cwi-world` | outline | Tabler Icons |
| `cwi-api` | outline | Tabler Icons |
| `cwi-plug-connected` | outline | Tabler Icons |
| `cwi-stack-2` | outline | Tabler Icons |
| `cwi-box` | outline | Tabler Icons |
| `cwi-package` | outline | Tabler Icons |
| `cwi-browser` | outline | Tabler Icons |
| `cwi-device-mobile` | outline | Tabler Icons |
| `cwi-device-desktop` | outline | Tabler Icons |
| `cwi-user` | outline | Tabler Icons |
| `cwi-users` | outline | Tabler Icons |
| `cwi-robot` | outline | Tabler Icons |
| `cwi-mail` | outline | Tabler Icons |
| `cwi-message-circle` | outline | Tabler Icons |
| `cwi-bell` | outline | Tabler Icons |
| `cwi-lock` | outline | Tabler Icons |
| `cwi-key` | outline | Tabler Icons |
| `cwi-shield-check` | outline | Tabler Icons |
| `cwi-eye` | outline | Tabler Icons |
| `cwi-fingerprint` | outline | Tabler Icons |
| `cwi-file-text` | outline | Tabler Icons |
| `cwi-folder` | outline | Tabler Icons |
| `cwi-code` | outline | Tabler Icons |
| `cwi-terminal-2` | outline | Tabler Icons |
| `cwi-git-branch` | outline | Tabler Icons |
| `cwi-git-pull-request` | outline | Tabler Icons |
| `cwi-settings` | outline | Tabler Icons |
| `cwi-tool` | outline | Tabler Icons |
| `cwi-clock` | outline | Tabler Icons |
| `cwi-calendar` | outline | Tabler Icons |
| `cwi-check` | outline | Tabler Icons |
| `cwi-x` | outline | Tabler Icons |
| `cwi-alert-triangle` | outline | Tabler Icons |
| `cwi-info-circle` | outline | Tabler Icons |
| `cwi-refresh` | outline | Tabler Icons |
| `cwi-bolt` | outline | Tabler Icons |
| `cwi-filter` | outline | Tabler Icons |
| `cwi-search` | outline | Tabler Icons |
| `cwi-upload` | outline | Tabler Icons |
| `cwi-download` | outline | Tabler Icons |
| `cwi-arrow-right` | outline | Tabler Icons |
| `cwi-arrows-exchange` | outline | Tabler Icons |
| `cwi-link` | outline | Tabler Icons |
| `cwi-chart-bar` | outline | Tabler Icons |
| `cwi-chart-line` | outline | Tabler Icons |
| `cwi-report-analytics` | outline | Tabler Icons |
| `cwi-flag` | outline | Tabler Icons |
| `cwi-bookmark` | outline | Tabler Icons |
| `cwi-star` | outline | Tabler Icons |
| `cwi-trash` | outline | Tabler Icons |
| `cwi-edit` | outline | Tabler Icons |
| `cwi-copy` | outline | Tabler Icons |
| `cwi-external-link` | outline | Tabler Icons |
| `cwi-github` | brand | Simple Icons |
| `cwi-gitlab` | brand | Simple Icons |
| `cwi-docker` | brand | Simple Icons |
| `cwi-kubernetes` | brand | Simple Icons |
| `cwi-terraform` | brand | Simple Icons |
| `cwi-postgresql` | brand | Simple Icons |
| `cwi-mysql` | brand | Simple Icons |
| `cwi-mongodb` | brand | Simple Icons |
| `cwi-redis` | brand | Simple Icons |
| `cwi-apachekafka` | brand | Simple Icons |
| `cwi-elasticsearch` | brand | Simple Icons |
| `cwi-snowflake` | brand | Simple Icons |
| `cwi-databricks` | brand | Simple Icons |
| `cwi-grafana` | brand | Simple Icons |
| `cwi-prometheus` | brand | Simple Icons |
| `cwi-python` | brand | Simple Icons |
| `cwi-typescript` | brand | Simple Icons |
| `cwi-javascript` | brand | Simple Icons |
| `cwi-nodedotjs` | brand | Simple Icons |
| `cwi-react` | brand | Simple Icons |
| `cwi-rust` | brand | Simple Icons |
| `cwi-go` | brand | Simple Icons |
| `cwi-googlecloud` | brand | Simple Icons |
| `cwi-anthropic` | brand | Simple Icons |
| `cwi-googlegemini` | brand | Simple Icons |
| `cwi-huggingface` | brand | Simple Icons |
| `cwi-jupyter` | brand | Simple Icons |
| `cwi-linux` | brand | Simple Icons |
| `cwi-nginx` | brand | Simple Icons |
| `cwi-cloudflare` | brand | Simple Icons |
| `cwi-vercel` | brand | Simple Icons |
| `cwi-figma` | brand | Simple Icons |
| `cwi-notion` | brand | Simple Icons |
