# ADR-0002: Sources and citations

## Status

Accepted

## Date

2026-08-24

## Context

The billionaire-watcher project constructs dossiers from multiple Brazilian public data sources. To maintain credibility and allow verification, every fact presented in the HTML must be traceable to a **public** origin. The pipeline may use proprietary data access (e.g., Base dos Dados Pro) for efficiency, but the HTML citations must reference publicly accessible sources.

Key sources include:
- **Receita Federal (RF) CNPJ registry**: companies, establishments, and ownership (QSA - Quadro de Sócios e Administradores)
- **CVM (Comissão de Valores Mobiliários)**: listed company financial reports (FRE - Formulário de Referência)
- **TSE (Tribunal Superior Eleitoral)**: campaign donations

The pipeline must handle:
- Data timeliness vs. public availability
- Matching persons in the freeze to entities in source datasets
- CNPJ grain (8-digit vs. 14-digit)
- CPF privacy (masking, no full CPF in HTML)
- UBO (Ultimate Beneficial Ownership) vs. direct ownership

## Decision

### RF CNPJ via Base dos Dados

**Source**: `basedosdados.br_rf_cnpj` dataset (tables: `empresas`, `estabelecimentos`, `socios`)

**Access**: Base dos Dados Pro is allowed in the pipeline for low-latency access to the latest CNPJ data (~6 month lag from RF public dumps).

**Citation constraint**: HTML `Source.locator` must reference a **public** origin:
- RF official CNPJ dump (via gov.br)
- Public Base dos Dados tables (accessible without Pro)
- Never "Base dos Dados Pro table" alone

If a fact derives from BD Pro data not yet in the public tier, the citation references the underlying RF dump date or public BD refresh date.

### CVM FRE (Formulário de Referência)

**Source**: Yearly ZIP files from `dados.cvm.gov.br`

**Status**: FRE data is **not yet** in Base dos Dados as of 2026-08-24.

**v1 approach**: Extract FRE directly from CVM ZIPs in the pipeline. Parallel track: contribute FRE to Base dos Dados pipelines; v1 does not wait for BD integration.

**UBO constraint**: FRE §6 organograma (ownership structure) identifies controlling shareholders for listed companies. If FRE data is not available for a given company, the HTML must show a **visible hole** (e.g., "CVM ownership data not available"). RF QSA edges are labeled "sócio" (partner) in the graph, **never** "UBO" or "controlling shareholder"—that classification requires CVM or other regulatory filings.

### Donations: Closed electoral cycles (through 2024)

**Source**: `basedosdados.br_tse_eleicoes.receitas_candidato`

**Coverage**: All donations through the 2024 electoral cycle.

**Context**: Corporate donations (PJ → campaign) have been illegal in Brazil since 2016. Historical data (pre-2016) includes CNPJ-based donations.

### Donations: 2026 cycle

**Source**: TSE Dados Abertos prestação (accountability) ZIPs, refreshed throughout 2026.

**Match logic**:
- Match individual donors (PF/CPF) to freeze persons
- Match campaign and party CNPJs to entities in the control chain
- CNPJ donations in 2026 are rare (illegal for PJ since 2016); primarily match control-chain CNPJs for historical (pre-2016) donations

**CPF handling**: TSE provides masked CPF (`documento` field). Match to RF `socios.cpf_cnpj_socio` (also masked). **No full CPF** appears in the HTML.

### Matching strategy

**Grain**: Match freeze persons to:
- CNPJs in the control chain (direct ownership or via CVM FRE)
- CPF (masked) for individual donations and RF QSA

**Name-only matches**: Weak matches (name similarity without CPF/CNPJ confirmation) do **not** add new persons to the freeze. The freeze is manually curated; the pipeline only enriches freeze persons with Facts, it does not expand the freeze via fuzzy matching.

### CNPJ grain

**8-digit vs. 14-digit**:
- RF QSA operates at `cnpj_basico` (8 digits): a single QSA record covers all branches (estabelecimentos) of a company
- CVM listed issuers use `CNPJ_CIA` (14 digits): the full CNPJ including branch/checksum

**Alphanumeric CNPJs**: As of July 2026, RF began issuing alphanumeric CNPJs (mixing letters and digits). The pipeline must handle both legacy numeric and new alphanumeric CNPJs.

**Pipeline handling**: Normalize all CNPJs to 8-digit `cnpj_basico` for QSA joins. Preserve full 14-digit CNPJ for CVM and TSE matches. Document the grain in dbt model comments.

## Consequences

### Positive

- Every HTML fact is traceable to a public source, preserving credibility
- BD Pro accelerates the pipeline without compromising citation integrity
- Visible holes for missing CVM data prevent false precision
- Masked CPF protects privacy while enabling donation matching
- Clear UBO vs. direct ownership distinction avoids mischaracterization

### Negative

- CVM FRE is not in BD yet; v1 requires custom extraction from CVM ZIPs
- Parallel BD contribution effort is a dependency for future maintainability
- CNPJ grain (8 vs. 14) requires careful normalization and documentation
- Alphanumeric CNPJs increase matching complexity

### Neutral

- TSE 2026 data refresh is handled in ADR-0005 (deferred for v1)
- Name-only weak matching is out of scope; freeze curation remains manual

## Rejected Alternatives

### Allow "BD Pro table" as sole citation

**Rejected**: Would undermine public verifiability. The pipeline may use BD Pro, but citations must reference public RF dumps, public BD, or direct government sources.

### Wait for CVM FRE in Base dos Dados

**Rejected**: Would block v1. The parallel contribution track allows us to ship v1 with custom CVM extraction while contributing upstream.

### Infer UBO from RF QSA alone

**Rejected**: RF QSA shows direct partners (`socios`), not controlling shareholders. CVM FRE §6 or equivalent regulatory filings are required to classify UBO. Without them, edges are labeled "sócio," not "UBO."

### Store full CPF in pipeline or HTML

**Rejected**: Privacy violation. TSE and RF provide masked CPF; the pipeline preserves masking. Full CPF is never needed for the v1 use case.

### Normalize all CNPJs to 14 digits

**Rejected**: RF QSA operates at 8-digit `cnpj_basico`. Normalizing to 14 would require inventing branch/checksum digits, causing false joins. Normalize to 8 for QSA, preserve 14 for CVM/TSE.
