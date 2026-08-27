# dbt Billionaire Watcher

dbt-bigquery project skeleton for the Billionaire Watcher civic archive.

## Status

The old warehouse layer (freeze walk, hops, valor-universo graph, person-money,
facts, TSE matches and their seeds) was removed. The design of the replacement
pipeline — the three tables `empresas`, `pessoas`, and `pessoas_empresas` with
the `e_oligarca` flag — lives in [docs/spec-fase1-oligarcas.md](../docs/spec-fase1-oligarcas.md).
Issues #178 and #179 implement the company door and upward ownership walk:

- **`empresas`** (`models/empresas.sql`): one company per `empresa_id`, built
  from seed A union the CVM, BCB, and SUSEP seed-B registries, plus intermediate
  holdings cited during the upward walk with `motivo_entrada = subida`. It
  left-joins optional size floors without dropping uncovered companies.
- **`pessoas_empresas`** (`models/pessoas_empresas.sql`): every cited natural
  person relationship reached from a walkable seed. FRE rows are
  `acionista_controlador` or `acionista`; Receita rows are always `socio`.
- **`pessoas`** (`models/pessoas.sql`): one natural person per CPF-backed or
  provisional identity, with `e_oligarca` derived only from qualifying FRE
  relationships on seed companies.
- **`int_walk_roots`** (`models/int_walk_roots.sql`): the shared one-column set
  of seed companies allowed to start a walk.
- **Generic macros** (`macros/`): `generate_schema_name`, `digits_only`,
  `prefix8_from_cnpj14`, `normalize_company_name`, `normalize_person_name`,
  `person_id_from_cpf`, plus a cross-adapter empty string-array helper.

- **CVM staging readers** (`models/staging/`): pure type-cast/normalize readers,
  reusable by the fase 1 pipeline:

| Model | Description | Grain |
|-------|-------------|-------|
| `stg_cvm_fre_posicao_acionaria_2026` | CVM FRE shareholder positions | (CNPJ_Companhia, Data_Referencia, ID_Acionista) |
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

### Land the company size-floor inputs

The floor downloader writes seven raw extracts plus a checksum manifest:

```bash
cd transform
python3 scripts/download_fase1_floor_sources.py \
  --year 2026 \
  --ifdata-period 202603 \
  --output-dir landing/fase1/pisos
```

Upload the CSVs under
`gs://billionairewatcher-landing/raw/fase1/pisos/`, matching
`models/sources.yml`.

The three floor families and exact sources are:

- **Bolsa:** B3
  [`GetInitialCompanies`](https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetInitialCompanies)
  with `type=1` and
  [`GetListedSupplementCompany`](https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall/GetListedSupplementCompany)
  for quantities; CVM
  [`fca_cia_aberta_2026.zip`](https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_2026.zip)
  maps `Codigo_Negociacao` to CNPJ; B3
  [`COTAHIST_A2026.ZIP`](https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A2026.ZIP)
  supplies official `PREULT` closes for `TPMERC=010`, `CODBDI=02`.
  `basedosdados.br_b3_cotacoes.cotacoes` is a trade tape and is never used as
  a COTAHIST substitute.
- **Banks:** BCB
  [`IfDataValores`](https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata/)
  at **prudential grain only** (`TipoInstituicao=1`), `Relatorio='2'`,
  `Conta=140220`, field `Saldo`. `IfDataCadastro` maps the reporter to its
  leading `codigoCNPJ8`; the BCB registry supplies the real full headquarters
  CNPJ. Individual and financial-conglomerate grains are never mixed in.
- **Insurers:** SUSEP
  [`ReceitasSeguros(Ano=@Ano)`](https://dados.susep.gov.br/olinda/servico/receitasoperacionais/versao/v1/odata/)
  field `valor`, summed as annual-to-date emitted premiums. The SES field
  `premio_ganho` is not used.

`int_empresas_piso` resolves cross-family overlap with deterministic precedence
Bolsa → IF.data → SUSEP. `empresas` left-joins it: no floor means
`tem_piso=false`, never removal from the company door.

### CNPJ Normalization

**Critical:** CNPJ fields are normalized as STRING to preserve leading zeros:

- **`cnpj_basico`** (RF): 8-digit STRING, lpad 8 — JBS is `'02916265'`
- **`CNPJ_Companhia`, `CNPJ_CIA`** (CVM): 14-digit STRING, strip punctuation,
  lpad 14 — JBS is `'02916265000160'` (from `02.916.265/0001-60`)

### RF Partner Edges: sócio, never dono/UBO

RF CNPJ `socios` lists **sócio** (partner) relationships as recorded in the
Quadro de Sócios e Administradores. It does **NOT** compute beneficial
ownership. Any controlador interpretation must come from the CVM FRE
shareholder-position file, never be inferred from RF alone.

The walk filters QSA to ownership qualifications: administrator-, director-,
president-, and council-only rows never become owners. QSA has no percentage or
control signal, so those fields remain null. A closed S.A. (`natureza_juridica`
2054) stops because QSA is not a public shareholder book.

### Upward ownership walk

For each seed with `nao_caminha = false`, the recursive walk uses the largest
`ID_Documento` per company from
`fre_cia_aberta_posicao_acionaria_2026.csv`. Companies without a FRE position
use Receita `socios` and `empresas` at `rf_partition_date`. It stops at
`Outros`, treasury shares, closed S.A.s without a public shareholder book,
unknown shareholder types, and cycles. It does not use
`fre_cia_historico_emissor`, the frozen public graph, or hop JSON.

The unit seam in `tests/unit_test_fase1_ownership_walk.yml` uses the three seed
registries plus FRE and QSA slices. Alice Controladora is true through
controller `S` on a seed; Camila Citada is false below 10%; Diana Holding stays
false because her controller citation is on a `subida` company; and the two
CPF-less JOAO SILVA citations remain separate.

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
