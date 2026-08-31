# Profile: stg_rf_socio

Source: `rf.socios` — copy of `basedosdados.br_me_cnpj.socios` partition `2026-01-11`. Already snake_case. Full 14 BD columns land (`SELECT *`).

## Overview

- **Grain**: one QSA partner row of a `cnpj_basico` in that snapshot
- **Primary key**: none. The same documento can appear on many companies; the same company has many partners.

## Column analysis

`documento` is masked. `tipo` ∈ {1,2,3}. `qualificacao` is a 2-digit code. Partition columns `ano`/`mes`/`data` are already typed in the BD copy.

Tests must use `where data = '{{ var("rf_partition_date") }}'`. Do not full-scan.

## Recommended seed filter (not applied)

Ownership qualificacao set `{20,21,22,23,24,25,26,28,29,30,31,34,37,38,47,48,49,50,52,53,54,55,56,57,58,59,65,66,67,68,74,75,78,79}`. Never treat administrators (e.g. `05`) as owners.
