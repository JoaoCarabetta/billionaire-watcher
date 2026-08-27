# dbt Billionaire Watcher

dbt-bigquery project skeleton for the Billionaire Watcher civic archive.

## Status

The old warehouse layer (freeze walk, hops, valor-universo graph, person-money,
facts, TSE matches and their seeds) was removed. The design of the replacement
pipeline — the three tables `empresas`, `pessoas`, and `pessoas_empresas` with
the `e_oligarca` flag — lives in [docs/spec-fase1-oligarcas.md](../docs/spec-fase1-oligarcas.md).
Implementation is future work; this project intentionally contains only:

- **Generic macros** (`macros/`): `generate_schema_name`, `digits_only`,
  `prefix8_from_cnpj14`, `normalize_company_name`, `normalize_person_name`,
  `person_id_from_cpf`. No hop or freeze grain.
- **CVM staging readers** (`models/staging/`): pure type-cast/normalize readers,
  reusable by the fase 1 pipeline:

| Model | Description | Grain |
|-------|-------------|-------|
| `stg_cvm_fre_posicao_acionaria_2026` | CVM FRE 6.1 shareholder positions | (CNPJ_Companhia, Data_Referencia, ID_Acionista) |
| `stg_cvm_fre_capital_social_2026` | CVM FRE 17.1 capital social | (CNPJ_Companhia, ID_Documento, Tipo_Capital, ID_Capital_Social) |
| `stg_cvm_cad_cia_aberta` | CVM listed company registry | CNPJ_CIA |

- **Frozen v0 seed CSVs** (`seeds/`): `b3_listed_prices.csv`,
  `listed_prices_fixture.csv`, `energisa_edges_fixture.csv`. These stay only
  because the shipped site tooling (`metrics/money.ts`,
  `src/lib/listed-quantities.ts`, `test/grafo-money.test.ts`) reads them from
  these paths. They are not inputs of the fase 1 pipeline.

## Data Sources (kept source definitions)

- **RF CNPJ**: Base dos Dados `basedosdados.br_me_cnpj` (`socios`, `empresas`,
  `estabelecimentos`), partition `{{ var("rf_partition_date") }}` (`2026-01-11`)
- **CVM**: GCS `gs://billionairewatcher-landing/raw/cvm/fre/2026/`
  (`fre_cia_aberta_posicao_acionaria_2026.csv`,
  `fre_cia_aberta_capital_social_2026.csv`, `cad_cia_aberta.csv`;
  latin-1, semicolon)

### CNPJ Normalization

**Critical:** CNPJ fields are normalized as STRING to preserve leading zeros:

- **`cnpj_basico`** (RF): 8-digit STRING, lpad 8 — JBS is `'02916265'`
- **`CNPJ_Companhia`, `CNPJ_CIA`** (CVM): 14-digit STRING, strip punctuation,
  lpad 14 — JBS is `'02916265000160'` (from `02.916.265/0001-60`)

### RF Partner Edges: sócio, never dono/UBO

RF CNPJ `socios` lists **sócio** (partner) relationships as recorded in the
Quadro de Sócios e Administradores. It does **NOT** compute beneficial
ownership. Any controlador interpretation must come from CVM FRE 6.1, never be
inferred from RF alone.

## Setup

1. `pip install dbt-bigquery`
2. Copy `profiles.yml.example` to `~/.dbt/profiles.yml` and fill in GCP credentials
3. `dbt deps`

## Usage

```bash
dbt parse                              # syntax check
dbt test --select test_type:unit       # unit tests (fixtures only, no GCP)
dbt run                                # staging readers (requires BigQuery)
```

### Continuous Integration

GitHub Actions (`.github/workflows/dbt-ci.yml`) runs `dbt parse` and
`dbt test --select test_type:unit` on every PR and push that touches
`transform/`. No GCP credentials required — unit tests use fixtures on duckdb.

## Warehouse IDs

- **GCP Project**: `billionairewatcher`
- **Dataset**: `billionairewatcher.billionaire_watcher`
- **Location**: `US`
- **GCS Landing**: `gs://billionairewatcher-landing/`

## License

See [LICENSE](../LICENSE).
