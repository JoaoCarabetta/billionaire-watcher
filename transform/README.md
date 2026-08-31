# dbt Billionaire Watcher

Three BigQuery datasets in project `billionairewatcher` (location `US`):

| Dataset | Role |
|---|---|
| `raw` | As ingested. One native table per source file or snapshot. No business filters. |
| `staging` | Typed and cleaned, still one model per origin. Empty until the next pass. |
| `marts` | Entities ready to serve (`empresas`, `pessoas`, `vinculos`, `percursos`). Empty until the next pass. |

The endpoint remains [docs/spec-fase1-oligarcas.md](../docs/spec-fase1-oligarcas.md). This pass only owns `raw`.

GCS `gs://billionairewatcher-landing/` is the file archive. dbt **declares** `raw` tables as sources; it does not build them.

## Raw inventory

All identifier columns (CNPJ, CPF) are STRING. Query `raw._manifest` for source URL, as-of date, GCS URI, sha256, and row count.

| Origin | Table | Landed from |
|---|---|---|
| valor | `valor_controle_empresas_walk` | `data/controle-empresas-walk.csv` |
| cvm | `cvm_cad_cia_aberta` | dados.cvm.gov.br cadastro |
| cvm | `cvm_fre_posicao_acionaria_2026` | FRE posição acionária 2026 |
| cvm | `cvm_fre_capital_social_2026` | FRE capital social 2026 |
| cvm | `cvm_fca_valor_mobiliario_2026` | FCA valor mobiliário 2026 |
| bcb | `bcb_entidades_supervisionadas` | Unicad EntidadesSupervisionadas |
| bcb | `bcb_ifdata_cadastro` | IF.data cadastro |
| bcb | `bcb_ifdata_ativo_total_prudencial` | IF.data Relatorio 2, Conta 140220 |
| susep | `susep_dados_cadastrais` | DadosCadastrais (no `$top`) |
| susep | `susep_receitas_seguros_2026` | ReceitasSeguros 2026 |
| b3 | `b3_listed_companies` | GetInitialCompanies type=1 |
| b3 | `b3_listed_supplement` | GetListedSupplementCompany |
| b3 | `b3_cotahist_2026` | COTAHIST_A2026, TPMERC=010, CODBDI=02 |
| rf | `rf_socios`, `rf_empresas`, `rf_estabelecimentos` | Base dos Dados `br_me_cnpj` partition `{{ var("rf_partition_date") }}` (`2026-01-11`) |

Receita tables are a **copy** of that partition into this project. Do not query `basedosdados.br_me_cnpj` from staging or marts.

`basedosdados.br_b3_cotacoes.cotacoes` is a trade tape, not COTAHIST. Do not use it as a close-price substitute.

## Land files, then load raw

Downloaders only write files. They do not filter seed B or compute floors.

```bash
cd transform
python3 scripts/download_fase1_company_sources.py \
  --bcb-date 08-01-2026 \
  --output-dir landing/fase1
python3 scripts/download_fase1_floor_sources.py \
  --year 2026 \
  --ifdata-period 202603 \
  --output-dir landing/fase1/pisos
```

Upload to the objects already used by the loader:

```bash
gcloud storage cp landing/fase1/cad_cia_aberta.csv \
  gs://billionairewatcher-landing/raw/cvm/fre/2026/cad_cia_aberta.csv
gcloud storage cp \
  landing/fase1/controle-empresas-walk.csv \
  landing/fase1/bcb_entidades_supervisionadas.csv \
  landing/fase1/susep_dados_cadastrais.csv \
  gs://billionairewatcher-landing/raw/fase1/
gcloud storage cp landing/fase1/pisos/*.csv \
  gs://billionairewatcher-landing/raw/fase1/pisos/
```

Load native `raw` tables (STRING schemas) and copy the Receita partition:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/caminho/da-service-account.json
python3 scripts/load_raw.py --credentials "$GOOGLE_APPLICATION_CREDENTIALS"
```

## Setup

1. `pip install dbt-bigquery`
2. Copy `profiles.yml.example` to `~/.dbt/profiles.yml` and fill in GCP credentials
3. `dbt deps`

```bash
dbt parse --target test
```

GitHub Actions runs `dbt parse` on every PR and push that touches `transform/`. No GCP credentials required.

Frozen v0 seed CSVs under `seeds/` stay because site tests read those file paths. They are disabled on the warehouse target and are not raw inputs.

## Warehouse IDs

- **GCP Project**: `billionairewatcher`
- **Datasets**: `raw`, `staging`, `marts`
- **Location**: `US`
- **GCS Landing**: `gs://billionairewatcher-landing/`

The previous datasets `billionaire_watcher`, `billionaire_watcher_raw`, and
`graph_probe` were emptied. The loader service account cannot delete dataset
objects (`bigquery.datasets.delete`). Drop those three empty leftovers from the
console or an owner account when convenient.

## License

See [LICENSE](../LICENSE).
