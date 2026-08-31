# Profile: stg_cvm_cia_aberta

Source: `cvm.cad_cia_aberta`. Live header confirmed 2026-08-31 (47 columns). Warehouse row counts were not readable (no BigQuery list permission). Spec snapshot: 757 rows with `SIT = ATIVO` in August 2026.

## Overview

- **Grain**: one registered issuer
- **Primary key**: `id_cvm` (and `id_cnpj` after pad). Old tests treated both as unique.

## Column analysis

Identifiers `CNPJ_CIA` (punctuated 18-char) and `CD_CVM` are complete on the official file. Dates are ISO or empty. `SIT` includes at least `ATIVO` and `CANCELADA`. `CONTROLE_ACIONARIO` is `PRIVADO` / `ESTATAL` / `ESTRANGEIRO` — type of control, not the person.

CEP, DDD and telephone stay STRING (old staging wrongly cast CEP to INT64).

## Data quality issues

- Punctuated CNPJ must be digits + `lpad` 14. Canonical check: JBS `02916265000160`.
- Address municipality is a name, not `id_municipio`.

## Relationships

- `id_cnpj` is the join key for FRE, FCA, and seed B.

## Recommended seed filter (not applied)

`situacao = 'ATIVO'` (757 issuers in the August 2026 apuração).
