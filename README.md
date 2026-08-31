# billionaire-watcher

Warehouse and local graph for mapping economic power in Brazil.

| Path | Role |
|---|---|
| [AGENTS.md](AGENTS.md) | Rules for working in this repo |
| [transform/](transform/README.md) | dbt on BigQuery (`raw` → `staging` → `marts`) |
| [graph/](graph/README.md) | Local Memgraph scratch pad |
| [docs/spec-fase1-oligarcas.md](docs/spec-fase1-oligarcas.md) | Warehouse specification (source of truth) |

```sh
cd transform && dbt parse --target test
```
