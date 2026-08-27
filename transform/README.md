# dbt Billionaire Watcher

dbt-bigquery project skeleton for the Billionaire Watcher civic archive.

## Status

The old warehouse layer (freeze walk, hops, valor-universo graph, person-money,
facts, TSE matches and their seeds) was removed. The design of the replacement
pipeline — the three tables `empresas`, `pessoas`, and `pessoas_empresas` with
the `e_oligarca` flag — lives in [docs/spec-fase1-oligarcas.md](../docs/spec-fase1-oligarcas.md).
Issue #178 implements the first slice of that replacement:

- **`empresas`** (`models/empresas.sql`): one company per `empresa_id`, built
  from seed A union the CVM, BCB, and SUSEP seed-B registries. It does not walk
  ownership or calculate a size floor.
- **Generic macros** (`macros/`): `generate_schema_name`, `digits_only`,
  `prefix8_from_cnpj14`, `normalize_company_name`, `normalize_person_name`,
  `person_id_from_cpf`, plus a cross-adapter empty string-array helper.

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
- **Fase 1 landing**: GCS `gs://billionairewatcher-landing/raw/fase1/`
  (`controle-empresas-walk.csv`, `bcb_entidades_supervisionadas.csv`,
  `susep_dados_cadastrais.csv`). The corresponding BigQuery external tables
  are declared under the `fase1_landing` source.

### Land the company-door inputs

The downloader uses only Python's standard library. It copies seed A from the
repository, fetches CVM using latin-1/semicolon as published, calls BCB with
`dataBase=@dataBase` inside `EntidadesSupervisionadas(...)`, and fetches the
full SUSEP dump without `$top`:

```bash
cd transform
python3 scripts/download_fase1_company_sources.py \
  --bcb-date 08-01-2026 \
  --output-dir landing/fase1
```

The BCB extraction fails unless the named `SedesBancoComMultCE` check is 154
for the reference date. Its raw bank-seat check includes BCB type 11; the dbt
seed filter then explicitly excludes type 11 together with types 3 and 9.
`manifest.json` records source URLs, row counts, checksums, and the check.

Upload the generated files to the objects used by `models/sources.yml`:

```bash
gcloud storage cp landing/fase1/cad_cia_aberta.csv \
  gs://billionairewatcher-landing/raw/cvm/fre/2026/cad_cia_aberta.csv
gcloud storage cp \
  landing/fase1/controle-empresas-walk.csv \
  landing/fase1/bcb_entidades_supervisionadas.csv \
  landing/fase1/susep_dados_cadastrais.csv \
  gs://billionairewatcher-landing/raw/fase1/
```

Define the three `fase1_landing` external relations with CNPJ fields as
`STRING`; never allow schema inference to turn identifiers into integers.

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
