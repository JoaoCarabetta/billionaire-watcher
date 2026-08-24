# ADR-0001: Data plane

## Status

Accepted

## Date

2026-08-24

## Context

The billionaire-watcher project requires a data architecture that handles raw source data, performs transformations, publishes structured facts, and serves static HTML. The architecture must balance cost, performance, maintainability, and the constraints of static site generation. Key considerations include:

- **Source of truth**: Where raw data and freeze snapshots are maintained
- **Transform engine**: Where SQL transformations and business logic execute
- **Publication target**: Where Facts (structured JSONL) are published for consumption by the static site generator
- **Hosting**: Where the final HTML is served
- **Version control**: What belongs in git vs. object storage
- **File size limits**: Cloudflare Pages has a 25 MiB per-file cap

The freeze CSV (`freeze/{date}.csv` + `freeze/latest.csv`) is a curated list of persons to track. It must be accessible to both the transform pipeline and the static site generator.

## Decision

### Google Cloud Storage (GCS)

GCS is the **source of truth** for:
- Raw source data (CNPJ, CVM, TSE downloads)
- Staging/intermediate data
- The freeze CSV (`freeze/{date}.csv` + `freeze/latest.csv`)

Maintainers update the freeze directly on GCS, not in git.

### BigQuery

BigQuery performs **all transformations**. The project maintains its own dataset and:
- Copies only the freeze-chain `cnpj_basico` values from Base dos Dados `br_rf_cnpj` tables
- Never scans the full `br_rf_cnpj` dataset to avoid costs and permission dependencies

All SQL logic, staging models, and fact generation happens in BigQuery via dbt.

### Cloudflare R2

R2 is the **publication target** for:
- Facts JSONL: `facts/{date}/{person}.jsonl` and `latest/{person}.jsonl`
- A copy of the freeze CSV so the Astro static site can determine which persons have dossier URLs

The static site generator (Astro) reads from R2 at build time, not from BigQuery.

### Git

Git stores:
- Code (Python, SQL, JavaScript)
- dbt project (models, tests, exposures)
- Astro project (pages, components, layouts)
- Test fixtures for the Fact→HTML seam only

Git does **not** store:
- Production Facts JSONL
- Production freeze CSV
- Raw source data

### Cloudflare Pages

Cloudflare Pages hosts the final static HTML. The 25 MiB per-file cap informs the design: large data must be split into per-person files (JSONL) rather than monolithic JSON.

## Consequences

### Positive

- Clear separation: GCS for raw data, BigQuery for transforms, R2 for publication, git for code
- BigQuery dataset scoped to freeze-chain CNPJs keeps query costs predictable
- R2 as publication layer decouples static site builds from BigQuery permissions and costs
- Git remains focused on code; production data lives in object storage
- Dated freeze snapshots (`freeze/{date}.csv`) allow historical rebuilds without mutating the current freeze

### Negative

- Requires three storage systems (GCS, R2, BigQuery dataset) with corresponding IAM and lifecycle management
- Freeze CSV is duplicated: GCS (source of truth) → R2 (for Astro)
- Developers must have GCS/BigQuery/R2 credentials to run the full pipeline locally

### Neutral

- Cloudflare Pages 25 MiB limit is not a constraint given the per-person JSONL design
- Future: if the static site needs to query BigQuery directly (rejected for v1), R2 remains useful as a cache layer

## Rejected Alternatives

### Facts and freeze in git

**Rejected**: Git is unsuitable for large, frequently updated binary or structured data. Facts JSONL would bloat the repository and slow clones. The freeze CSV might fit in git, but storing it only in object storage (GCS + R2) is simpler and more consistent.

### DuckDB as transform engine

**Rejected**: DuckDB is excellent for local/embedded analytics, but BigQuery's serverless model, integration with Base dos Dados, and SQL dialect familiarity make it a better fit. dbt-bigquery has stronger ecosystem support than dbt-duckdb.

### Postgres OLTP

**Rejected**: The pipeline is batch-oriented, not transactional. Postgres would require managing a long-lived instance, backups, and migrations. BigQuery's serverless model and columnar storage are better suited to the read-heavy, analytical workload.

### Amazon S3

**Rejected**: GCS integrates better with BigQuery. R2 is chosen over S3 for publication because Cloudflare Pages and R2 are in the same ecosystem, reducing egress costs and simplifying configuration.

### BigQuery at HTML build time

**Rejected**: Querying BigQuery during Astro's static site generation would require BigQuery credentials in the CI/CD environment, increase build time, and couple the site to BigQuery availability. Pre-publishing Facts to R2 decouples concerns and makes builds faster and more reliable.
