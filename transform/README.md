# dbt Billionaire Watcher

dbt-bigquery project for the Billionaire Watcher civic archive.

## Overview

This dbt project transforms raw data from Base dos Dados (RF CNPJ) and CVM (listed companies) into staging models for the billionaire-watcher civic archive.

### Architecture

The project follows a three-layer architecture as defined in [ADR-0003](../docs/adr/0003-dbt-bigquery-in-this-repo.md):

1. **Staging** (`models/staging/`) - Light transformations, type casting, CNPJ normalization
2. **Match** (future) - Entity resolution and person-to-CNPJ matching
3. **Facts** (future) - One row per fact with sources and citations

The project implements staging (issue #10) and freeze walk (issue #25) layers. Match and Facts layers are future work.

### Data Sources

- **RF CNPJ**: Base dos Dados `basedosdados.br_me_cnpj` (empresas, socios, estabelecimentos)
  - Partition: `DATE '2026-01-11'`
  - Freeze staging is restricted to 50 freeze-chain CNPJs (top companies from Valor 1000)
  - Issue #88 vehicle QSA models use a separate nine-key warehouse seed; the freeze roots are unchanged
- **CVM**: GCS `gs://billionairewatcher-landing/raw/cvm/fre/2026/`
  - `fre_cia_aberta_posicao_acionaria_2026.csv` (shareholder positions)
  - `fre_cia_aberta_capital_social_2026.csv` (item 17.1 capital social)
  - `cad_cia_aberta.csv` (registered listed companies)
  - Encoding: latin-1, delimiter: semicolon

### Staging Models

| Model | Description | Grain |
|-------|-------------|-------|
| `stg_rf_socios` | RF CNPJ partners (sócios) | (cnpj_basico, tipo, nome, documento) |
| `stg_rf_empresas` | RF CNPJ companies | cnpj_basico |
| `stg_rf_estabelecimentos` | RF CNPJ establishments | cnpj (14-digit) |
| `stg_group_flags` | Top-50 group flags from Valor | cnpj_basico |
| `stg_cvm_fre_posicao_acionaria_2026` | CVM FRE 6.1 shareholder positions | (CNPJ_Companhia, Data_Referencia, ID_Acionista) |
| `stg_cvm_fre_capital_social_2026` | CVM FRE 17.1 capital social | (CNPJ_Companhia, ID_Documento, Tipo_Capital, ID_Capital_Social) |
| `stg_cvm_cad_cia_aberta` | CVM listed company registry | CNPJ_CIA |

### Vehicle QSA Models (Issue #88)

`vehicle_qsa_partners` and `vehicle_qsa_companies_owned` are warehouse-enabled
tables backed by the separate `vehicle_cnpj_basicos` seed. They do not widen
`stg_rf_socios` or modify the fifty `freeze_cnpj_basicos` roots. Both queries use
`{{ var("rf_partition_date") }}` (`2026-01-11`).

Partners of each vehicle:

```sql
select tipo, nome, documento, qualificacao, data_entrada_sociedade
from basedosdados.br_me_cnpj.socios
where data = date '2026-01-11'
  and lpad(cast(cnpj_basico as string), 8, '0') = '<vehicle_cnpj_basico>'
```

Companies where each vehicle is a PJ partner:

```sql
select
  lpad(cast(s.cnpj_basico as string), 8, '0') as owned_cnpj_basico,
  e.razao_social,
  s.qualificacao,
  s.documento
from basedosdados.br_me_cnpj.socios as s
join basedosdados.br_me_cnpj.empresas as e
  on lpad(cast(e.cnpj_basico as string), 8, '0')
   = lpad(cast(s.cnpj_basico as string), 8, '0')
 and e.data = s.data
where s.data = date '2026-01-11'
  and cast(s.tipo as string) = '1'
  and substr(
    lpad(regexp_replace(cast(s.documento as string), r'[^0-9]', ''), 14, '0'),
    1,
    8
  ) = '<vehicle_cnpj_basico>'
```

The second query compares the first eight normalized CNPJ digits. It must never
use substring containment. Each model emits one count-zero row with its concrete
source query when a configured key has no match. Receita provides no percentage
column, so `percent` remains null.

### Holding QSA invert (Issue #110)

`holding_qsa_companies_owned` is a warehouse-enabled invert of Receita Quadro de
Sócios for six graph holdings, backed by the separate `holding_invert_cnpj_basicos`
seed. It does not reuse `vehicle_cnpj_basicos` (those nine are the Gipar/Itacatu
set). It does not write public HTML or `/grafo`.

Grain: one PJ sócio row per (owner, owned company), or one explicit empty row
when a configured key has no match (`owned_company_count=0`). Match is prefix-8
of a normalized 14-digit PJ `documento` (`tipo='1'`) at `rf_partition_date`
(`2026-01-11`). Never `regexp_contains`. Never invent a branch suffix.
`percent` is always null. Owned-company identity is the 8-digit `owned_cnpj_basico`,
`owned_name`, and `qualificacao`.

`size_warning` is true when `bank_book` is set on the seed and the owner has at
least one owned company, or when `owned_company_count` meets
`holding_owned_size_warning_threshold` (40). Banco BTG stays in the warehouse
table and off `/grafo`.

```sql
select
  lpad(cast(s.cnpj_basico as string), 8, '0') as owned_cnpj_basico,
  e.razao_social,
  s.qualificacao,
  s.documento
from basedosdados.br_me_cnpj.socios as s
join basedosdados.br_me_cnpj.empresas as e
  on lpad(cast(e.cnpj_basico as string), 8, '0')
   = lpad(cast(s.cnpj_basico as string), 8, '0')
 and e.data = s.data
where s.data = date '2026-01-11'
  and cast(s.tipo as string) = '1'
  and left(
    lpad(regexp_replace(cast(s.documento as string), r'[^0-9]', ''), 14, '0'),
    8
  ) = '<owner_cnpj_basico>'
```

### Valor × cadastro inventory (Issue #140)

`valor_cadastro_inventory` is a warehouse table, not a graph. Universe =
Valor 1000 2025 industrial ranks 1–500 ∪ banks 2025 ∪ insurers 2025.
Join is prefix-8 of the cadastro CNPJ when a top-50 flags key exists,
otherwise normalized razão social. Never invent `/0001`. `percent` is
always null. Globo 81 and Record 354 stay as closed rows. Dexco is not a
Votorantim seed. XP is not on the launch add-list. No public HTML, no
`/grafo`.

`valor_cadastro_inventory_counts` emits the four leftover-planning counts
(ATIVO in universe, already on graph, named launch add-list size, leftover
after launch).

### Freeze Models (Issue #25)

Freeze walk models implementing grupo × pessoa natural × papel per issue #22 spec:

| Model | Description | Grain |
|-------|-------------|-------|
| `int_freeze_listed_controllers` | Listed controllers from FRE 6.1 walk | (cnpj_basico, person_name) |
| `int_freeze_soe` | SOE groups with skip_soe status | cnpj_basico |
| `int_freeze_unlisted_rf` | Unlisted controllers from RF QSA | (cnpj_basico, person_name) |
| `int_freeze_foreign_hq` | Foreign HQ groups (hole unless publicly named) | cnpj_basico |
| `freeze_persons` | Final freeze table (positional freeze) | (group_rank, person_name, role) |
| `int_forbes_candidates` | Forbes safety-net candidates | person_name |
| `freeze_persons_with_forbes` | Final freeze + Forbes safety-net | (group_rank, person_name, role) |

#### Freeze Count Audit (2026-08-24 warehouse run)

Real `dbt run` in `billionairewatcher.billionaire_watcher` on 2026-08-24:

**Before walk bug fix (issue #50):**

| controlador_tipo | freeze_status | row_count | group_count | notes |
|-----------------|---------------|-----------|-------------|-------|
| listed | in | 95 | 9 | Marfrig, Rede D'Or, Suzano, Simpar, RD Saúde, Magalu, WEG, Energisa, Mateus |
| listed | hole | 491 | 27 | **BUG**: One hole per PJ controller line, even when group has PF 'in' rows |
| foreign | hole | 49 | 19 | One hole per foreign group (correct) |
| unlisted | hole | 3 | 3 | One hole per unlisted group (correct) |
| soe | skip_soe | 1 | 1 | Petrobras (correct) |
| **TOTAL** | | **639** | **50** | |

**After walk bug fix (issue #50):**

| controlador_tipo | freeze_status | row_count | group_count | notes |
|-----------------|---------------|-----------|-------------|-------|
| listed | in | 95 | 9 | Same 9 groups with named PF controllers |
| listed | hole | 18 | 18 | **FIXED**: 27 listed groups − 9 with named PF = 18 hole-only groups |
| foreign | hole | 19 | 19 | One hole per foreign group (no change) |
| unlisted | hole | 3 | 3 | One hole per unlisted group (no change) |
| soe | skip_soe | 1 | 1 | Petrobras (no change) |
| **TOTAL** | | **136** | **50** | |

**Locked grain per group:**
- One path per top-50 group (50 total)
- `in`: one row per named PF controller (multiple PFs OK)
- `hole`: at most ONE row per group, and ONLY if that group has zero named PF
- `skip_soe`: one row (Petrobras)

Groups with both 'in' and 'hole' rows (like WEG with 133 hole + 44 in) was the bug. After fix: the 9 groups with named PF emit ONLY 'in' rows (XOR); the remaining 18 listed groups emit one 'hole' row each.

### Forbes Safety-Net (Issue #26)

Forbes safety-net adds natural persons as `role=candidato_forbes` and `freeze_status=review` AFTER the positional freeze. Forbes rows are ADDITIVE on top of `freeze_persons`.

**Input Source:** The `forbes_billionaires_brazil_nexus` seed is **FIXTURE DATA ONLY** for testing Forbes safety-net logic. It does NOT contain real Forbes billionaires, actual USD wealth estimates, or live Forbes data. Do NOT use this seed as a live Forbes extract.

**CRITICAL - Production Exclusion:** The `forbes_billionaires_brazil_nexus` and `tse_donations_2026` seeds are **DISABLED on the warehouse target** (dev) and prod via `enabled: "{{ target.name in ['test', 'ci'] }}"` in `seeds/schema.yml`. The warehouse profile uses target name `dev` (see `profiles.yml.example`), which is excluded. Only test/ci targets may seed these fixtures. These seeds must NEVER be loaded into the `billionairewatcher` warehouse. Unit tests use the CSVs as fixtures without loading them to BigQuery.

**Add ONLY if ALL of:**
- On Forbes World's Billionaires (seed/fixture, not live scrape)
- Brazil-operations nexus = true
- cnpj_basico is NOT NULL (identified Brazil-operating group; group MAY be outside top-50)
- NOT already in positional freeze
- Documentable control of Brazil-operating group

**Do NOT add:**
- Celebrities/athletes without group control
- Dispersed family fortunes
- Monarchs/office-tied wealth
- Wikipedia names without control documentation
- Brazil-nexus without identified cnpj_basico (Saverin-style: nexus but no documentable group control)

**No auto-promotion:** Models do NOT auto-promote to `freeze_status=in` even when control_doc is available. Humans promote after review.

**GAP-FORBES-BR-URL:** No separate Forbes Brazil methodology URL exists. The global Forbes World's Billionaires list is used with a Brazil-nexus filter applied in the fixture/seed.

**Key Constraints:**
- LISTED: Walk FRE 6.1 Acionista_Controlador=S to natural persons
- SOE: freeze_status=skip_soe, no PF controller (União is not a person)
- UNLISTED: RF QSA edges labeled 'socio', never 'acionista_controlador' (QSA is not shareholder book)
- FOREIGN HQ: Hole unless FRE 6.1.h / 20-F / 13D publicly names PF
- No edge_label 'dono' or 'UBO' (RF does not compute beneficial ownership)
- Missing controller = hole (not CEO fill-in or offshore invention)
- cpf_masked only (no full CPF on page-bound fields)

### CNPJ Normalization

**Critical:** CNPJ fields are normalized as STRING to preserve leading zeros:

- **`cnpj_basico`** (RF, group_flags): 8-digit STRING, lpad 8
  - Example: JBS is `'02916265'` (not `2916265`)
- **`CNPJ_Companhia`, `CNPJ_CIA`** (CVM): 14-digit STRING, strip punctuation, lpad 14
  - Example: JBS is `'02916265000160'` (from `02.916.265/0001-60`)

Unit tests verify leading-zero preservation for both formats.

### Schema Name Override

The project uses a custom `generate_schema_name` macro (`macros/generate_schema_name.sql`) to land all models and seeds directly in the `billionaire_watcher` dataset, not `billionaire_watcher_billionaire_watcher`.

**Warehouse location:** `billionairewatcher.billionaire_watcher` (project: `billionairewatcher`, dataset: `billionaire_watcher`, region: `US`)

This macro strips the redundant project-name prefix that dbt-bigquery would otherwise append.

### RF Partner Edges: sócio, never dono/UBO

**Important:** RF CNPJ `socios` table lists **sócio** (partner) relationships as recorded in the QSA. It does **NOT** compute beneficial ownership (dono/UBO). Any UBO interpretation must be derived from other sources (e.g., CVM FRE 6.1), not inferred from RF alone.

The `stg_rf_socios` model documentation explicitly states this constraint to prevent incorrect UBO assumptions in downstream work.

## Setup

### Prerequisites

- Python 3.9+
- `dbt-bigquery` 1.7+
- GCP credentials with access to:
  - `billionairewatcher` project
  - `basedosdados` project (for Base dos Dados sources)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/JoaoCarabetta/billionaire-watcher.git
   cd billionaire-watcher/transform
   ```

2. **Install dbt-bigquery:**

   ```bash
   pip install dbt-bigquery
   ```

3. **Configure dbt profile:**

   Copy `profiles.yml.example` to `~/.dbt/profiles.yml` and fill in your GCP credentials:

   ```bash
   cp profiles.yml.example ~/.dbt/profiles.yml
   # Edit ~/.dbt/profiles.yml with your GCP project and authentication method
   ```

4. **Install dbt packages:**

   ```bash
   dbt deps
   ```

## Usage

### Running Models

```bash
# Parse the project (checks for syntax errors)
dbt parse

# Load seeds (freeze CNPJs and group flags)
dbt seed

# Run all staging models
dbt run

# Run a specific model
dbt run --select stg_rf_socios

# Run models with their dependencies
dbt run --select stg_rf_socios+
```

### Testing

```bash
# Run all tests (schema tests + unit tests)
dbt test

# Run only unit tests (no GCP credentials required if using fixtures)
dbt test --select test_type:unit

# Run schema tests (requires BigQuery access)
dbt test --select test_type:generic

# Test a specific model
dbt test --select stg_rf_socios
```

### Unit Tests

Unit tests use dbt's native unit testing feature (fixtures only, no live BigQuery calls). To run unit tests:

```bash
dbt test --select test_type:unit
```

Unit tests verify:
- Leading-zero preservation for `cnpj_basico` (8-digit STRING)
- Leading-zero preservation for full CNPJs (14-digit STRING)
- CNPJ punctuation stripping (e.g., `02.916.265/0001-60` → `02916265000160`)
- RF partner edges are sócio, never dono/UBO

### Continuous Integration

GitHub Actions runs `dbt parse` and `dbt test --select test_type:unit` on every PR and push that touches `transform/` or the workflow itself. No GCP credentials required — unit tests use fixtures only.

### Variables

The project defines variables in `dbt_project.yml`:

- `rf_partition_date`: RF partition date (default: `2026-01-11`)

Override variables at runtime:

```bash
dbt run --vars '{"rf_partition_date": "2026-02-15"}'
```

## Warehouse IDs

- **GCP Project**: `billionairewatcher`
- **Dataset**: `billionairewatcher.billionaire_watcher`
- **Location**: `US`
- **GCS Landing**: `gs://billionairewatcher-landing/`
  - `raw/cvm/fre/2026/` (CVM files)
  - `freeze/` (freeze CSV source of truth)

## Out of Scope

Out of scope for current implementation:

- Match models (entity resolution)
- Facts models (structured JSONL with citations)
- TSE donations (deferred)
- HTML generation (Astro, separate concern)
- R2 export (dbt v1 does not touch R2)
- Forbes safety-net (issue #26)
- Recursion before 4 Oct (per spec #22)

## Development

### Adding a New Staging Model

1. Create `models/staging/stg_<source>_<table>.sql`
2. Add model documentation to `models/staging/schema.yml`
3. Add not_null and unique/unique_combination tests
4. Create unit tests in `tests/unit_test_staging.yml`
5. Run `dbt parse && dbt test --select test_type:unit` to verify

### Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

## License

See [LICENSE](../LICENSE).

---
CI: All 44 unit tests passing (2026-08-25)

<!-- ci-retrigger: 2026-08-25 -->
# CI test 1787619945
