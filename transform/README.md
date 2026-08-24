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
  - Restricted to 50 freeze-chain CNPJs (top companies from Valor 1000)
- **CVM**: GCS `gs://billionairewatcher-landing/raw/cvm/fre/2026/`
  - `fre_cia_aberta_posicao_acionaria_2026.csv` (shareholder positions)
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
| `stg_cvm_cad_cia_aberta` | CVM listed company registry | CNPJ_CIA |

### Freeze Models (Issue #25)

Freeze walk models implementing grupo × pessoa natural × papel per issue #22 spec:

| Model | Description | Grain |
|-------|-------------|-------|
| `int_freeze_listed_controllers` | Listed controllers from FRE 6.1 walk | (cnpj_basico, person_name) |
| `int_freeze_soe` | SOE groups with skip_soe status | cnpj_basico |
| `int_freeze_unlisted_rf` | Unlisted controllers from RF QSA | (cnpj_basico, person_name) |
| `int_freeze_foreign_hq` | Foreign HQ groups (hole unless publicly named) | cnpj_basico |
| `freeze_persons` | Final freeze table | (group_rank, person_name, role) |

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
