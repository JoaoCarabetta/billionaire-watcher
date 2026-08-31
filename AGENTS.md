# AGENTS.md

This repo is a **data warehouse + local graph scratch pad** for mapping economic power in Brazil. There is no website here.

Phase 1 answers only **who the oligarchs are** (natural persons with a documentable material position in companies). Phase 2 (state influence: TSE, offices, contracts) is out of scope.

## Read first

1. [docs/spec-fase1-oligarcas.md](docs/spec-fase1-oligarcas.md) — product and warehouse source of truth. Do not contradict it.
2. [transform/README.md](transform/README.md) — datasets, staging inventory, land-then-load.
3. [graph/README.md](graph/README.md) — local Memgraph only.

If a past conversation, old issue, or leftover comment talks about Astro, Cloudflare Pages, `src/`, `public/`, `metrics/`, `freeze_*`, hops, or valor-universo, that work is gone. Do not revive it.

## Layout

| Path | Role |
|---|---|
| `transform/` | dbt project. Owns `raw` declarations, staging models, future marts. |
| `graph/` | Local Memgraph copy of the frozen v0 graph. Not a warehouse input. |
| `docs/spec-fase1-oligarcas.md` | Locked decisions: grains, `e_oligarca`, walk, floors, out of scope. |
| `.github/workflows/dbt-ci.yml` | `dbt deps` + `dbt parse --target test` (DuckDB). No GCP. |
| `service_accounts/` | Local GCP keys. Gitignored. Never commit, never paste. |

## Warehouse layers

GCP project `billionairewatcher`, location `US`. Custom schemas are written as-is (`staging`, `marts`) via `generate_schema_name`.

| Layer | Dataset | Rule |
|---|---|---|
| Landing | `gs://billionairewatcher-landing/` | Files only. Downloaders do not filter seed B or compute floors. |
| `raw` | `raw` | Native tables, all identifiers STRING. dbt **declares** them in `models/sources.yml`; it does not build them. Loader: `transform/scripts/load_raw.py`. |
| `staging` | `staging` | One model per origin. Hygiene only: types, `lpad`, Base dos Dados names. **No** seed-B filters, **no** walk, **no** `e_oligarca`. Contracts enforced. |
| `marts` | `marts` | Endpoint: `empresas`, `pessoas`, `pessoas_empresas`. `empresas` this pass is one row per CNPJ from seed A (Valor lists, no extras): `cnpj`, `razao_social`, `capital_social`, `motivo_entrada_*`. Seed B, walk, and `e_oligarca` live here later, never in staging. |

Receita tables in this project are a **copy** of Base dos Dados partition `{{ var("rf_partition_date") }}` (`2026-01-11`). Staging and marts query **this** project, not `basedosdados.br_me_cnpj`.

`basedosdados.br_b3_cotacoes.cotacoes` is a trade tape. Do not use it as a COTAHIST close.

## Hard rules

- **Identifiers are STRING.** CNPJ 14, CNPJ básico 8, CPF 11. Digits only, `lpad` to keep leading zeros. Never invent `/0001`. Canonical check: JBS `02916265000160`.
- **CPF is warehouse-only.** Full 11-digit CPF never goes into public JSON, markdown, HTML, or JSON-LD. Public mask if needed: `***NNN***`. `pessoa_id` with CPF is `person_id_from_cpf` (`p-` + 8 hex of sha256).
- **Do not merge homonyms without CPF.** Same name, no CPF → two `pessoa_id`s.
- **Valor 1000 is seed A, not the definition.** `e_oligarca` is true iff the person is cited with FRE `Acionista_Controlador` = `S` **or** `Percentual_Acao_Ordinaria_Circulacao` ≥ 10 in at least one firm of seed A ∪ B. Size floor does not enter the flag.
- **Floor is not a gate.** `tem_piso` = false does not drop a company or stop the walk.
- **Walk up** from A ∪ B except `nao_caminha` (Folha, Globo, Havan, Record, Natura-without-CNPJ). Stop at `Outros`, treasury shares, or closed S.A. without a public shareholder book. QSA links are `socio`; never mint administrators/directors as owners. `tem_informacao_de_controle` = no on Receita edges.
- **Walk down** is one hop, from `e_oligarca` = true, by **CPF never name**. Hop companies do not flip `e_oligarca`. New partners of hop companies are not inverted.
- **Unit is the natural person.** Family is later. Forbes is editorial check only. Do not invent fortune; unlabeled paths stay `fortuna_incompleta`.
- **Cite source column names** (`CNPJ_CIA`, `Acionista_Controlador`, …) in docs. The Base dos Dados rename lives in `transform/architecture/`.

## Changing staging

Architecture CSVs in `transform/architecture/` are the source of truth for column names, BigQuery types, units, directories, and dictionary flags. Then keep these in lockstep:

1. `transform/architecture/stg_*.csv`
2. `transform/models/staging/<origin>/stg_*.sql` — use hygiene macros (`clean_string`, `cnpj14`, `cnpj8`, `to_date`, `to_numeric`, `parse_br_numeric`, …)
3. `transform/models/staging/<origin>/_stg_<origin>.yml` — contract + tests
4. `transform/models/staging/profiles/stg_*.md`
5. `transform/seeds/dicionario.csv` when `covered_by_dictionary` is yes
6. `transform/models/sources.yml` if the raw table is new

Generators exist (`transform/scripts/_write_architecture.py`, `_write_staging_yml.py`) but review their output; do not treat them as a license to skip the spec.

Naming: [Base dos Dados style](https://basedosdados.org/docs/style_data) — snake_case, singular, no year in the table name, `id_` only for entity keys, `proporcao_` 0–100. Deviations we keep: `stg_` prefix, `NUMERIC` for money, identifiers always STRING.

DuckDB `test` only **parses**. `dbt run` / `dbt test` against models that read `raw` need `--target dev` (BigQuery).

## Graph

`graph/` loads `graph/grafo-publico.json` into Memgraph (`Pessoa` / `Empresa` / `OWNS`). It is a frozen v0 snapshot, **not** the warehouse walk and **not** the full Receita QSA. Do not treat it as a source for marts. Do not rewrite it to match the spec.

## Commands

```sh
# transform — from transform/
dbt deps
dbt parse --target test
dbt test --select test_type:unit --target test
dbt run --select staging empresas --target dev
dbt test --select staging empresas --target dev

# land files (no filters), then load raw
python3 scripts/download_fase1_company_sources.py --bcb-date 08-01-2026 --output-dir landing/fase1
python3 scripts/download_fase1_floor_sources.py --year 2026 --ifdata-period 202603 --output-dir landing/fase1/pisos
# upload to the GCS objects already referenced by load_raw.py, then:
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service_accounts/….json
python3 scripts/load_raw.py --credentials "$GOOGLE_APPLICATION_CREDENTIALS"

# graph — from graph/
docker compose up -d
.venv/bin/python load_grafo_publico.py
```

Setup: `pip install dbt-bigquery`; copy `transform/profiles.yml.example` to `~/.dbt/profiles.yml`.

After transform edits, run `dbt parse --target test` before calling the work done. After a new staging model, also `dbt run` + `dbt test` on `dev` if credentials are available.

## Tests (when marts exist)

Prefer **few** seams. The required seam is end-to-end on final grain: small slices of the three cadastres + FRE + QSA emit `empresas` / `pessoas` / `pessoas_empresas` with one known `e_oligarca` = true and one known false. Cover negatives **inside** that seam (Receita partner is never `acionista_controlador`; homonyms do not merge; hop does not flip the flag; no floor does not drop). Do not add a unit YAML per intermediate model.

## Do not

- Recreate the static site, `package.json`, or site-only dbt seeds.
- Query `basedosdados.br_me_cnpj` or `basedosdados.br_b3_cotacoes` from staging/marts.
- Put seed-B filters (`SIT = ATIVO`, Unicad/SUSEP gates) in staging.
- Use `fre_cia_historico_emissor` as ownership (it is issuer history, not posição acionária).
- Use SUSEP `premio_ganho` / SES unless documented as a different account. Floor for insurers is `valor` (prêmios emitidos).
- Commit `service_accounts/`, `transform/profiles.yml`, `transform/landing/`, or `graph/.memgraph/`.
