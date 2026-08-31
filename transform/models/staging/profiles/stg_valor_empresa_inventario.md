# Profile: stg_valor_empresa_inventario

Source: `valor.controle_empresas_walk` (`data/controle-empresas-walk.csv`). Profiled locally on 2026-08-31 (653 rows). BigQuery `raw` was not readable from this environment.

## Overview

- **Row count**: 653
- **Grain**: one inventory company as listed in the walk CSV
- **Primary key**: none. `identificador` is not unique (469 rows share the sentinel `vazio`). `nome` has 6 collisions (Cargill, Stellantis, Volkswagen, Honda, Gazin twice with `vazio`; Rodobens once with CNPJ and once with `vazio`).

## Column analysis

| Column | Nulls / empty | Notes |
|---|---|---|
| nome | 0 | 647 distinct |
| identificador | 0 | 185 distinct. Values: 14-digit CNPJ, slugs `folha`/`globo`/`havan`/`record`, or `vazio` |
| tipo_societario | 0 | `desconhecido` 469, `sociedade anônima aberta` 180, `sociedade anônima fechada` 4 |
| no_grafo | 0 | `não` 469, `sim` 184 |
| porque | 1 | Free text, unique per row when present |
| situacao_do_passeio | 0 | `só inventário` 468, `árvore no grafo` 141, `pulada-já-semente` 35, `grupo sem sócio` 4, `buraco` 4, `inventário-fechada-não-andar` 1 |
| no_formulario | 0 | `não` 473, `sim` 176, `buraco` 4 |
| notas | 612 empty | Operator notes |

## Data quality issues

- `vazio` is a sentinel, not a blank. Staging keeps it in `identificador` and sets `id_cnpj` null.
- Exact duplicate name+`vazio` pairs exist. Hygiene does not drop them.
- JBS `02916265000160` is present and must keep the leading zero.

## Relationships

- `id_cnpj` later joins CVM/BCB/SUSEP/RF. Many inventory rows will not join (no CNPJ).

## Recommended seed filter (not applied)

None at the extract level. Closed groups + Natura-sem-CNPJ become `nao_caminha` in marts, not here.
