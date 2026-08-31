# Profile: stg_rf_empresa

Source: `rf.empresas` — BD partition copy. Full BD columns including `porte` and `ente_federativo` omitted from the old sources.yml.

## Overview

- **Grain**: one company per `cnpj_basico` per snapshot
- **Primary key**: (`data`, `cnpj_basico`)

## Recommended seed filter (not applied)

Walk later skips `natureza_juridica = '2054'` (SA fechada). Staging keeps those rows.
